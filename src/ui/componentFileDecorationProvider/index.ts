import * as vscode from 'vscode';
import * as path from 'path';
import { ComponentEnvGraph } from '@makotot/component-env-graph';
import { typeIcon } from '../typeIcon';
import { getLabelByType } from '../../core/dependencyGraph';

export class ComponentFileDecorationProvider implements vscode.FileDecorationProvider {
    private graph: ComponentEnvGraph;
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    constructor(graph: ComponentEnvGraph) {
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
