import type { ComponentEnvGraph } from "@makotot/component-env-graph";
// biome-ignore lint/performance/noNamespaceImport: vscode cannot import with default import
import * as vscode from "vscode";
import { resolveRenderTreeEnv } from "../../core/resolveRenderTreeEnv/index.js";

export class ComposedServerInClientDecorator {
  private readonly graph: ComponentEnvGraph;
  private readonly decorationType: vscode.TextEditorDecorationType;

  constructor(context: vscode.ExtensionContext, graph: ComponentEnvGraph) {
    this.graph = graph;
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: "🌐 Server component composed in Client",
        margin: "0 0 0 4px",
        color: new vscode.ThemeColor("descriptionForeground"),
        fontStyle: "italic",
      },
    });

    context.subscriptions.push(this.decorationType);

    vscode.window.onDidChangeActiveTextEditor(
      (editor) => this.update(editor),
      this,
      context.subscriptions
    );
    vscode.workspace.onDidOpenTextDocument(
      () => this.update(vscode.window.activeTextEditor),
      this,
      context.subscriptions
    );

    this.graph.onDidUpdate(() => {
      this.update(vscode.window.activeTextEditor);
    });
    this.update(vscode.window.activeTextEditor);
  }

  private update(editor?: vscode.TextEditor) {
    if (!editor) {
      return;
    }
    const filePath = editor.document.uri.fsPath;
    if (!filePath.toLowerCase().endsWith(".tsx")) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const results = resolveRenderTreeEnv(this.graph, filePath);
    if (!results.length) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const lineToTagNames = new Map<number, Set<string>>();
    for (const result of results) {
      if (result.role !== "composed-server-in-client") {
        continue;
      }
      const line = editor.document.positionAt(result.range[0]).line;
      const names = lineToTagNames.get(line) ?? new Set<string>();
      names.add(result.tagName);
      lineToTagNames.set(line, names);
    }

    editor.setDecorations(
      this.decorationType,
      [...lineToTagNames.entries()].map(([line, tagNames]) => ({
        range: new vscode.Range(
          editor.document.lineAt(line).range.end,
          editor.document.lineAt(line).range.end
        ),
        hoverMessage: `Server component composed in client: ${Array.from(tagNames).join(", ")}`,
      }))
    );
  }
}
