import * as vscode from 'vscode';
import { DependencyGraph } from '../../core/dependencyGraph';
import { typeIcon } from '../typeIcon';

// Returns display info for each file type (status bar)
function getStatusBarDisplayForNode(node: { type?: string } | undefined): {
    text: string;
    tooltip: string;
    backgroundColor: vscode.ThemeColor;
} | undefined {
    if (!node) { return undefined; }
    switch (node.type) {
        case 'client':
            return {
                text: `${typeIcon.client} Client Component`,
                tooltip: 'This file is a Next.js Client Component',
                backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
            };
        case 'server':
            return {
                text: 'Server Component',
                tooltip: 'This file is a Next.js Server Component',
                backgroundColor: new vscode.ThemeColor('statusBarItem.debuggingBackground'),
            };
        case 'universal':
            return {
                text: `${typeIcon.universal} Universal Component`,
                tooltip: 'This file is a Universal Component (can be used as both Client and Server Component in Next.js)',
                backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground'),
            };
        default:
            return undefined;
    }
}

export class ClientComponentStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private graph: DependencyGraph;

    constructor(context: vscode.ExtensionContext, graph: DependencyGraph) {
        this.graph = graph;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.hide();
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('charts.purple');
        context.subscriptions.push(this.statusBarItem);

        // Update UI only on graph update
        this.graph.onDidUpdate(() => {
            this.update(vscode.window.activeTextEditor);
        });
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            this.update(editor);
        }, this, context.subscriptions);
        vscode.workspace.onDidOpenTextDocument((doc) => {
            this.update(vscode.window.activeTextEditor);
        }, this, context.subscriptions);
        this.update(vscode.window.activeTextEditor);
    }

    private update(editor?: vscode.TextEditor) {
        if (!editor || !this.graph) {
            this.statusBarItem.hide();
            return;
        }
        const filePath = editor.document.uri.fsPath;
        const node = this.graph.nodes.get(filePath);
        const display = getStatusBarDisplayForNode(node);
        if (display) {
            this.statusBarItem.text = display.text;
            this.statusBarItem.tooltip = display.tooltip;
            this.statusBarItem.backgroundColor = display.backgroundColor;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
}
