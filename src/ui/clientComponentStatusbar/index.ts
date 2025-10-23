import type { ComponentEnvGraph } from "@makotot/component-env-graph";
// biome-ignore lint/performance/noNamespaceImport: vscode cannot import with default import
import * as vscode from "vscode";
import { typeIcon } from "../typeIcon";

// Returns display info for each file type (status bar)
function getStatusBarDisplayForNode(node: { type?: string } | undefined):
  | {
      text: string;
      tooltip: string;
    }
  | undefined {
  if (!node) {
    return;
  }
  switch (node.type) {
    case "client":
      return {
        text: `${typeIcon.client} Client Component`,
        tooltip: "This file is a Next.js Client Component",
      };
    case "server":
      return {
        text: "Server Component",
        tooltip: "This file is a Next.js Server Component",
      };
    case "universal":
      return {
        text: `${typeIcon.universal} Universal Component`,
        tooltip:
          "This file is a Universal Component (can be used as both Client and Server Component in Next.js)",
      };
    default:
      return;
  }
}

export class ClientComponentStatusBar {
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly graph: ComponentEnvGraph;

  constructor(context: vscode.ExtensionContext, graph: ComponentEnvGraph) {
    this.graph = graph;
    const priority = 100; // higher priority to appear on the left
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      priority
    );
    this.statusBarItem.hide();
    context.subscriptions.push(this.statusBarItem);

    // Update UI only on graph update
    this.graph.onDidUpdate(() => {
      this.update(vscode.window.activeTextEditor);
    });
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        this.update(editor);
      },
      this,
      context.subscriptions
    );
    vscode.workspace.onDidOpenTextDocument(
      () => {
        this.update(vscode.window.activeTextEditor);
      },
      this,
      context.subscriptions
    );
    this.update(vscode.window.activeTextEditor);
  }

  private update(editor?: vscode.TextEditor) {
    if (!(editor && this.graph)) {
      this.statusBarItem.hide();
      return;
    }
    const filePath = editor.document.uri.fsPath;
    // Only show status for TSX component files
    if (!filePath.toLowerCase().endsWith(".tsx")) {
      this.statusBarItem.hide();
      return;
    }
    const node = this.graph.nodes.get(filePath);
    const display = getStatusBarDisplayForNode(node);
    if (display) {
      this.statusBarItem.text = display.text;
      this.statusBarItem.tooltip = display.tooltip;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }
}
