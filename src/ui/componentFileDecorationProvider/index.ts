import * as vscode from 'vscode';
import * as path from 'path';
import { DependencyGraph, getLabelByType } from '../../core/dependencyGraph';
import { typeIcon } from '../typeIcon';

export class ComponentFileDecorationProvider implements vscode.FileDecorationProvider {
    private graph: DependencyGraph;
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    constructor(graph: DependencyGraph) {
        this.graph = graph;
    }

    public refresh() {
        this._onDidChangeFileDecorations.fire(undefined);
    }

    provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
        const normalizedPath = path.resolve(uri.fsPath);
        const node = this.graph.nodes.get(normalizedPath);
        if (!node || !node.type) { return; }
        if (node.type === 'client') {
            return {
                badge: typeIcon.client,
                tooltip: getLabelByType('client') + ' Component',
                color: new vscode.ThemeColor('charts.purple'),
                propagate: true
            };
        }
        if (node.type === 'universal') {
            return {
                badge: typeIcon.universal,
                tooltip: getLabelByType('universal') + ' Component',
                color: new vscode.ThemeColor('charts.blue'),
                propagate: true
            };
        }
        // server/other: no badge
        return;
    }
}
