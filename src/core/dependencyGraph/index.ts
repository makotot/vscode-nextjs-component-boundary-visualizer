import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';

/**
 * Component type classification.
 * - 'client': Entry or dependency with "use client" directive
 * - 'server': Server-only component
 * - 'universal': Referenced from both client and server
 */
export type ComponentType = 'client' | 'server' | 'universal';

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

// Returns true if the file should be excluded from analysis (config, d.ts, test, spec, stories, __mocks__)
function isExcludedFile(filePath: string): boolean {
    return /\.(stories|config|d|test|spec)\.(ts|tsx)$|__mocks__/.test(filePath);
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
    /**
     * Registers a listener for dependency graph update events.
     * @param listener Callback function to invoke when the graph updates
     */
    onDidUpdate(listener: () => void) {
        this._onDidUpdate.on('update', listener);
    }
    /**
     * Emits an update event to all registered listeners.
     */
    private fireDidUpdate() {
        this._onDidUpdate.emit('update');
    }

    /**
     * Creates a new DependencyGraph instance.
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

    /**
     * Rebuilds the dependency graph. If changedFiles is specified, only those files and their dependencies are re-parsed.
     * Otherwise, only new/deleted files are added/removed and node information is updated.
     * For performance, a full rebuild is avoided whenever possible.
     * @param changedFiles Array of changed file paths (if omitted, performs a full scan)
     */
    build(changedFiles?: string[]) {
        let affectedFiles = new Set<string>();
        if (changedFiles && changedFiles.length > 0) {
            // Only remove/add changed files
            for (const changed of changedFiles) {
                const sf = this.project.getSourceFile(changed);
                if (sf) {
                    this.project.removeSourceFile(sf);
                }
                // Remove from nodes map if file no longer exists
                if (!require('fs').existsSync(changed)) {
                    this.nodes.delete(changed);
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
            // Only add files if not already present (avoid full remove/add cycle)
            const existingFiles = new Set(this.project.getSourceFiles().map(sf => sf.getFilePath().toString()));
            const glob = [
                path.join(this.rootDir, '**/*.ts'),
                path.join(this.rootDir, '**/*.tsx'),
                '!' + path.join(this.rootDir, '**/*.stories.tsx'), // Exclude stories.tsx files entirely
                '!' + path.join(this.rootDir, 'node_modules/**'),
                '!' + path.join(this.rootDir, '.git/**'),
                '!' + path.join(this.rootDir, '.next/**'),
            ];
            this.project.addSourceFilesAtPaths(glob);
            // Remove files that no longer exist
            const sourceFiles = this.project.getSourceFiles();
            const currentFileSet = new Set(sourceFiles.map(sf => sf.getFilePath().toString()));
            for (const filePath of Array.from(this.nodes.keys())) {
                if (!currentFileSet.has(filePath)) {
                    this.nodes.delete(filePath);
                    const sf = this.project.getSourceFile(filePath);
                    if (sf) { this.project.removeSourceFile(sf); }
                }
            }
        }
        const sourceFiles = this.project.getSourceFiles();
        logDebug('build: sourceFiles', sourceFiles.map(sf => sf.getFilePath()));
        // Always update all nodes for a full build
        if (!changedFiles || changedFiles.length === 0) {
            for (const sf of sourceFiles) {
                const filePath = sf.getFilePath().toString();
                if (isExcludedFile(filePath)) {
                    continue;
                }
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
                    if (isExcludedFile(filePath)) {
                        continue;
                    }
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

    /**
     * Classifies the type (client/server/universal) of all nodes.
     * - client: Entry point or dependency with a "use client" directive
     * - server: Not reachable from any client entry
     * - universal: Imported from both client and server components
     */
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
        // 4. universal: imported from both client and server (single pass)
        const importers = new Map<string, Set<string>>();
        // 1st pass: collect importers and check universal in one go
        for (const [fp, node] of this.nodes) {
            for (const imp of node.imports) {
                if (!importers.has(imp)) { importers.set(imp, new Set()); }
                importers.get(imp)!.add(fp);
            }
        }
        for (const [fp, node] of this.nodes) {
            if (node.isClient) { continue; }

            const from = importers.get(fp);
            if (!from) { continue; }

            let hasClient = false, hasServer = false;
            for (const importer of from) {
                const t = this.nodes.get(importer)?.type;
                if (t === 'client') { hasClient = true; }
                if (t === 'server') { hasServer = true; }
                if (hasClient && hasServer) {
                    node.type = 'universal';
                    break;
                }
            }
        }
        // No 'other' classification: config, d.ts, test, spec, stories, __mocks__, etc. are not handled here.
    }

    /**
     * Determines if the first statement in the file is a "use client" directive.
     * Only the first statement is checked, per Next.js spec.
     * @param sf ts-morph SourceFile
     * @returns true if the file is a client component
     */
    hasUseClientDirective(sf: SourceFile): boolean {
        // Only check the first statement for the exact 'use client' directive (no semicolon required)
        const stmts = sf.getStatements();
        if (stmts.length > 0) {
            const stmt = stmts[0];
            if (stmt.getKindName() === 'ExpressionStatement') {
                const text = stmt.getText().trim();
                // Accept both 'use client' and "use client" (with or without semicolon)
                if (text === "'use client'" || text === '"use client"' || text === "'use client';" || text === '"use client";') {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns an array of absolute file paths statically imported or re-exported by the given file.
     * @param sf ts-morph SourceFile
     * @returns Array of imported/re-exported file paths
     */
    getStaticImports(sf: SourceFile): string[] {
        // import ... from '...'
        const importFiles = sf.getImportDeclarations()
            .map(imp => {
                const f = imp.getModuleSpecifierSourceFile();
                return f ? f.getFilePath().toString() : undefined;
            })
            .filter((f): f is string => typeof f === 'string');
        // export * from '...'; export { ... } from '...';
        const exportFiles = sf.getExportDeclarations()
            .map(exp => {
                const f = exp.getModuleSpecifierSourceFile?.();
                return f ? f.getFilePath().toString() : undefined;
            })
            .filter((f): f is string => typeof f === 'string');
        return [...importFiles, ...exportFiles];
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
        default: return '';
    }
}
