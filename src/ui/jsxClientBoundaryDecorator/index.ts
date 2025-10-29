import type { ComponentEnvGraph } from "@makotot/component-env-graph";
// biome-ignore lint/performance/noNamespaceImport: vscode cannot import with default import
import * as vscode from "vscode";
import { resolveJsxClientBoundary } from "../../core/resolveJsxClientBoundary";
import { typeIcon } from "../typeIcon";

export class JsxClientBoundaryLineDecorator {
  private readonly graph: ComponentEnvGraph;
  private readonly lineEndDecorationType: vscode.TextEditorDecorationType;

  constructor(context: vscode.ExtensionContext, graph: ComponentEnvGraph) {
    this.graph = graph;
    this.lineEndDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: `${typeIcon.client} Client Boundary`,
        margin: "0 0 0 4px",
        color: new vscode.ThemeColor("descriptionForeground"),
        fontStyle: "italic",
      },
    });

    context.subscriptions.push(this.lineEndDecorationType);

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
      editor.setDecorations(this.lineEndDecorationType, []);
      return;
    }

    const boundaryResults = resolveJsxClientBoundary(this.graph, filePath);
    if (!boundaryResults.length) {
      editor.setDecorations(this.lineEndDecorationType, []);
      return;
    }

    // Group client-boundary components by line for end-of-line decoration
    const lineToClientTagNames = new Map<number, Set<string>>();
    for (const boundary of boundaryResults) {
      if (!boundary.boundary) {
        continue;
      }
      const startPosition = editor.document.positionAt(boundary.range[0]);
      const clientTagNamesForLine =
        lineToClientTagNames.get(startPosition.line) ?? new Set<string>();
      clientTagNamesForLine.add(boundary.tagName);
      lineToClientTagNames.set(startPosition.line, clientTagNamesForLine);
    }

    const lineEndDecorations: vscode.DecorationOptions[] = [];
    for (const [line, tagNames] of lineToClientTagNames) {
      const lineEndPosition = editor.document.lineAt(line).range.end;
      lineEndDecorations.push({
        range: new vscode.Range(lineEndPosition, lineEndPosition),
        hoverMessage: `Client boundary: ${Array.from(tagNames).join(", ")}`,
      });
    }

    editor.setDecorations(this.lineEndDecorationType, lineEndDecorations);
  }
}
