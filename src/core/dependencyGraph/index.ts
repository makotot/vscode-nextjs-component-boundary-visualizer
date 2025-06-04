import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';

/**
 * Component type classification.
 * - 'client': Entry or dependency with "use client" directive
 * - 'server': Server-only component
 * - 'universal': Referenced from both client and server
 * - 'other': Config, type definition, test, etc.
 */
export type ComponentType = 'client' | 'server' | 'universal' | 'other';

/**
 * Node information for each file in the dependency graph.
 */
export interface FileNode {
    filePath: string;
    isClient: boolean;
    imports: string[];
    type?: ComponentType;
}

// Simple logger utility (enabled only if VSCODE_APP_ROUTER_VISUALIZER_DEBUG is set)
function logDebug(...args: any[]) {
    if (process.env.VSCODE_APP_ROUTER_VISUALIZER_DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[DependencyGraph]', ...args);
    }
}

/**
 * Builds and manages the dependency graph for a Next.js App Router project.
 * UI components should use this class to retrieve file type information.
 */
export class DependencyGraph {
    nodes: Map<string, FileNode> = new Map();
    project: Project;
    rootDir: string;

    private _onDidUpdate = new (require('events').EventEmitter)();
    onDidUpdate(listener: () => void) {
        this._onDidUpdate.on('update', listener);
    }
    private fireDidUpdate() {
        this._onDidUpdate.emit('update');
    }

    /**
     * @param rootDir Project root directory
     * @param tsConfigFilePath Optional absolute path to tsconfig.json (default: <rootDir>/tsconfig.json)
     */
    constructor(rootDir: string, tsConfigFilePath?: string) {
        this.rootDir = rootDir;
        this.project = new Project({
            tsConfigFilePath: tsConfigFilePath || path.join(rootDir, 'tsconfig.json'),
            skipAddingFilesFromTsConfig: false,
        });
    }

    build(changedFiles?: string[]) {
        let affectedFiles = new Set<string>();
        if (changedFiles && changedFiles.length > 0) {
            // Only remove/add changed files
            for (const changed of changedFiles) {
                const sf = this.project.getSourceFile(changed);
                if (sf) {
                    this.project.removeSourceFile(sf);
                }
                try {
                    this.project.addSourceFileAtPath(changed);
                } catch (e) {
                    // Ignore if deleted, etc.
                }
                affectedFiles.add(changed);
            }
            // Also add dependencies imported by changed files
            for (const changed of changedFiles) {
                const sf = this.project.getSourceFile(changed);
                if (sf) {
                    const imports = this.getStaticImports(sf);
                    for (const imp of imports) {
                        affectedFiles.add(imp);
                    }
                }
            }
        } else {
            // Forget all existing SourceFiles
            this.project.getSourceFiles().forEach(sf => this.project.removeSourceFile(sf));
            this.project.addSourceFilesAtPaths([
                path.join(this.rootDir, '**/*.{ts,tsx}'),
                '!' + path.join(this.rootDir, 'node_modules/**'),
                '!' + path.join(this.rootDir, '.git/**'),
                '!' + path.join(this.rootDir, 'out/**'),
                '!' + path.join(this.rootDir, 'dist/**'),
            ]);
        }
        const sourceFiles = this.project.getSourceFiles();
        // --- Node cleanup added here ---
        const currentFileSet = new Set(sourceFiles.map(sf => sf.getFilePath().toString()));
        for (const filePath of Array.from(this.nodes.keys())) {
            if (!currentFileSet.has(filePath)) {
                this.nodes.delete(filePath);
            }
        }
        // --- Node cleanup ends here ---
        logDebug('build: sourceFiles', sourceFiles.map(sf => sf.getFilePath()));
        if (!changedFiles || changedFiles.length === 0) {
            this.nodes.clear();
            for (const sf of sourceFiles) {
                const filePath = sf.getFilePath().toString();
                const isClient = this.hasUseClientDirective(sf);
                const imports = this.getStaticImports(sf);
                this.nodes.set(filePath, { filePath, isClient, imports });
                logDebug('node', { filePath, isClient, imports });
            }
        } else {
            // Only update node info for changed files and their imports
            for (const sf of sourceFiles) {
                const filePath = sf.getFilePath().toString();
                if (affectedFiles.has(filePath)) {
                    const isClient = this.hasUseClientDirective(sf);
                    const imports = this.getStaticImports(sf);
                    this.nodes.set(filePath, { filePath, isClient, imports });
                    logDebug('node (partial update)', { filePath, isClient, imports });
                }
            }
        }
        this.classifyComponentTypes();
        for (const [fp, node] of this.nodes) {
            logDebug('node after classify', { filePath: fp, isClient: node.isClient, type: node.type });
        }
        this.fireDidUpdate();
    }

    classifyComponentTypes() {
        // 1. client entry points
        const clientEntries = Array.from(this.nodes.values()).filter(n => n.isClient).map(n => n.filePath);
        // 2. Enumerate nodes reachable from client
        const clientReachable = new Set<string>();
        const visit = (fp: string) => {
            if (clientReachable.has(fp)) { return; }
            clientReachable.add(fp);
            const node = this.nodes.get(fp);
            if (!node) { return; }
            for (const imp of node.imports) {
                if (this.nodes.has(imp)) { visit(imp); }
            }
        };
        for (const entry of clientEntries) { visit(entry); }
        // 3. Set type for each node
        for (const [fp, node] of this.nodes) {
            if (clientReachable.has(fp)) {
                node.type = 'client';
            } else {
                node.type = 'server';
            }
        }
        // 4. universal: imported from both client and server
        const importers = new Map<string, Set<string>>();
        for (const [fp, node] of this.nodes) {
            for (const imp of node.imports) {
                if (!importers.has(imp)) { importers.set(imp, new Set()); }
                importers.get(imp)!.add(fp);
            }
        }
        for (const [fp, node] of this.nodes) {
            const from = importers.get(fp);
            if (!from) { continue; }
            let hasClient = false, hasServer = false;
            for (const importer of from) {
                const t = this.nodes.get(importer)?.type;
                if (t === 'client') { hasClient = true; }
                if (t === 'server') { hasServer = true; }
            }
            if (hasClient && hasServer) {
                node.type = 'universal';
            }
        }
        // 5. other: config, d.ts, test, spec, stories, __mocks__, etc. (not a component)
        for (const [fp, node] of this.nodes) {
            const lower = fp.toLowerCase();
            if (
                /\.(config|d)\.[jt]sx?$/.test(lower) ||
                /\.(test|spec|stories)\.[jt]sx?$/.test(lower) ||
                /__mocks__/.test(lower)
            ) {
                node.type = 'other';
            }
        }
    }

    hasUseClientDirective(sf: SourceFile): boolean {
        const stmts = sf.getStatements();
        for (let i = 0; i < Math.min(5, stmts.length); i++) {
            const stmt = stmts[i];
            if (stmt.getKindName() === 'ExpressionStatement') {
                const text = stmt.getText().replace(/['";]/g, '').trim();
                if (text === 'use client') { return true; }
            }
        }
        return false;
    }

    getStaticImports(sf: SourceFile): string[] {
        return sf.getImportDeclarations()
            .map(imp => {
                const f = imp.getModuleSpecifierSourceFile();
                return f ? f.getFilePath().toString() : undefined;
            })
            .filter((f): f is string => typeof f === 'string');
    }
}

/**
 * Returns the color for each component type (for graph visualization).
 */
export function getColorByType(type?: ComponentType): string {
    switch (type) {
        case 'client': return 'red';
        case 'server': return 'black';
        case 'universal': return 'blue';
        case 'other': return 'gray';
        default: return 'gray';
    }
}

/**
 * Returns the label for each component type (for graph visualization).
 */
export function getLabelByType(type?: ComponentType): string {
    switch (type) {
        case 'client': return 'CLIENT';
        case 'server': return 'SERVER';
        case 'universal': return 'UNIVERSAL';
        case 'other': return 'OTHER';
        default: return '';
    }
}
