import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { DependencyGraph } from './index.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('DependencyGraph', function () {
    let tempDir: string;
    let graph: DependencyGraph;

    function write(file: string, content: string) {
        const fullPath = path.join(tempDir, file);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content);
    }
    function remove(file: string) {
        fs.rmSync(path.join(tempDir, file), { force: true });
    }

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-test-'));
        write('tsconfig.json', '{ "compilerOptions": { "jsx": "react" }, "include": ["**/*"] }');
        graph = new DependencyGraph(tempDir);
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    type TypeCase = {
        name: string;
        files: Record<string, string>;
        actions?: Array<{
            operation: 'write' | 'remove',
            filePath: string,
            content?: string,
            changedFiles?: string[]
        }>;
        expect: Record<string, string | undefined>;
    };

    const typeCases: TypeCase[] = [
        {
            name: 'client component (use client)',
            files: { 'client.tsx': '"use client"; export const C = () => null;' },
            expect: { 'client.tsx': 'client' }
        },
        {
            name: 'server component (no use client)',
            files: { 'server.tsx': 'export const S = () => null;' },
            expect: { 'server.tsx': 'server' }
        },
        {
            name: 'universal component',
            files: {
                'client.tsx': '"use client"; import { Sh } from "./universal"; export const C = () => null;',
                'server.tsx': 'import { Sh } from "./universal"; export const S = () => null;',
                'universal.tsx': 'export const Sh = () => null;'
            },
            expect: { 'universal.tsx': 'universal' }
        },
        {
            name: 'other: config, d.ts, test, spec, __mocks__',
            files: {
                'foo.config.ts': 'export const x = 1;',
                'foo.d.ts': 'export type X = number;',
                'foo.test.ts': 'export const t = 1;',
                'foo.spec.ts': 'export const s = 1;',
                '__mocks__/bar.ts': 'export const m = 1;'
            },
            expect: {
                'foo.config.ts': undefined,
                'foo.d.ts': undefined,
                'foo.test.ts': undefined,
                'foo.spec.ts': undefined,
                '__mocks__/bar.ts': undefined
            }
        },
        {
            name: 'updates type when use client is added/removed',
            files: { 'server.tsx': 'export const S = () => null;' },
            actions: [
                { operation: 'write', filePath: 'server.tsx', content: '"use client"; export const S = () => null;', changedFiles: ['server.tsx'] },
                { operation: 'write', filePath: 'server.tsx', content: 'export const S = () => null;', changedFiles: ['server.tsx'] }
            ],
            expect: { 'server.tsx': 'server' }
        },
        {
            name: 'removes node when file is deleted',
            files: { 'shared.tsx': 'export const Sh = () => null;' },
            actions: [
                { operation: 'remove', filePath: 'shared.tsx', changedFiles: ['shared.tsx'] }
            ],
            expect: { 'shared.tsx': undefined }
        },
        {
            name: 'handles circular dependencies',
            files: {
                'a.tsx': 'import { B } from "./b"; export const A = () => null;',
                'b.tsx': 'import { A } from "./a"; export const B = () => null;'
            },
            expect: { 'a.tsx': 'server', 'b.tsx': 'server' }
        },
        {
            name: 'handles import path case and extension variations',
            files: {
                'Upper.tsx': 'export const U = 1;',
                'importer.tsx': 'import { U } from "./Upper"; export const I = 1;'
            },
            expect: { 'Upper.tsx': 'server', 'importer.tsx': 'server' }
        },
        {
            name: 're-exported dependency from index.ts with use client',
            files: {
                'index.ts': '"use client"; export * from "./Button";',
                'Button.tsx': 'export const Button = () => null;'
            },
            expect: {
                'index.ts': 'client',
                'Button.tsx': 'client'
            }
        }
    ];

    typeCases.forEach(({ name, files, actions, expect: expected }) => {
        it(name, () => {
            Object.entries(files).forEach(([filePath, content]) => {
                const fullPath = path.join(tempDir, filePath);
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(fullPath, content);
            });
            graph.build();
            if (actions) {
                actions.forEach(action => {
                    if (action.operation === 'write') {
                        const fullPath = path.join(tempDir, action.filePath);
                        const dir = path.dirname(fullPath);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }
                        fs.writeFileSync(fullPath, action.content!);
                    } else if (action.operation === 'remove') {
                        remove(action.filePath);
                    }
                    graph.build((action.changedFiles || [action.filePath]).map(f => path.join(tempDir, f)));
                });
            }
            Object.entries(expected).forEach(([filePath, expectedType]) => {
                const node = graph.nodes.get(path.join(tempDir, filePath));
                if (expectedType === undefined) {
                    expect(node, `${filePath} should be removed from nodes`).toBeFalsy();
                } else {
                    expect(node && node.type, `${filePath} should be ${expectedType}`).toBe(expectedType);
                }
            });
        });
    });
});

describe('DependencyGraph tsConfigFilePath option', () => {
    it('uses custom tsconfig.json path if provided', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-test-'));
        const customTsconfigPath = path.join(tempDir, 'custom-tsconfig.json');
        fs.writeFileSync(customTsconfigPath, '{ "compilerOptions": { "jsx": "react" }, "include": ["**/*"] }');
        fs.writeFileSync(path.join(tempDir, 'client.tsx'), '"use client"; export const C = () => null;');
        const graph = new DependencyGraph(tempDir, customTsconfigPath);
        graph.build();
        const node = graph.nodes.get(path.join(tempDir, 'client.tsx'));
        expect(node).toBeTruthy();
        expect(node?.type).toBe('client');
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
    it('defaults to <rootDir>/tsconfig.json if no path is provided', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-test-'));
        fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{ "compilerOptions": { "jsx": "react" }, "include": ["**/*"] }');
        fs.writeFileSync(path.join(tempDir, 'client.tsx'), '"use client"; export const C = () => null;');
        const graph = new DependencyGraph(tempDir);
        graph.build();
        const node = graph.nodes.get(path.join(tempDir, 'client.tsx'));
        expect(node).toBeTruthy();
        expect(node?.type).toBe('client');
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
});
