import * as vscode from 'vscode';
import { ComponentEnvGraph } from '@makotot/component-env-graph';
import { typeIcon } from '../typeIcon';

export class ClientComponentLineDecorator {
    private graph: ComponentEnvGraph;
    private decoration: vscode.TextEditorDecorationType | undefined;

    constructor(context: vscode.ExtensionContext, graph: ComponentEnvGraph) {
        this.graph = graph;
        this.graph.onDidUpdate(() => {
            this.update(vscode.window.activeTextEditor);
        });
        vscode.window.onDidChangeTextEditorSelection(e => this.update(e.textEditor), this, context.subscriptions);
        vscode.window.onDidChangeActiveTextEditor(this.update, this, context.subscriptions);
        vscode.workspace.onDidOpenTextDocument(() => this.update(vscode.window.activeTextEditor), this, context.subscriptions);
        this.update(vscode.window.activeTextEditor);
    }

    private update(editor?: vscode.TextEditor) {
        if (!editor || !this.graph) { return; }
        const filePath = editor.document.uri.fsPath;
        const node = this.graph.nodes.get(filePath);
        if (this.decoration) {
            this.decoration.dispose();
            this.decoration = undefined;
        }
        if (node && node.type === 'client') {
            this.decoration = vscode.window.createTextEditorDecorationType({
                isWholeLine: true,
                backgroundColor: 'rgba(128,0,128,0.08)', // light purple
                before: {
                    contentText: typeIcon.client,
                    color: '#a259ff',
                    margin: '0 8px 0 0',
                    fontWeight: 'bold',
                },
            });
            const selections = editor.selections.map(sel => ({
                range: new vscode.Range(sel.start.line, 0, sel.start.line, 0),
                hoverMessage: 'Client Component',
            }));
            editor.setDecorations(this.decoration, selections);
        } else if (node && node.type === 'universal') {
            this.decoration = vscode.window.createTextEditorDecorationType({
                isWholeLine: true,
                backgroundColor: 'rgba(0, 120, 212, 0.08)', // light blue
                before: {
                    contentText: typeIcon.universal,
                    color: '#0078d4',
                    margin: '0 8px 0 0',
                    fontWeight: 'bold',
                },
            });
            const selections = editor.selections.map(sel => ({
                range: new vscode.Range(sel.start.line, 0, sel.start.line, 0),
                hoverMessage: 'Universal Component',
            }));
            editor.setDecorations(this.decoration, selections);
        }
    }
}
