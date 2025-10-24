// biome-ignore lint/performance/noNamespaceImport: node:path cannot import with default import
import * as path from "node:path";
import type { ComponentEnvGraph } from "@makotot/component-env-graph";
// biome-ignore lint/performance/noNamespaceImport: vscode cannot import with default import
import * as vscode from "vscode";
import { typeIcon } from "../typeIcon";

export class ComponentFileDecorationProvider
  implements vscode.FileDecorationProvider
{
  private readonly graph: ComponentEnvGraph;
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(graph: ComponentEnvGraph) {
    this.graph = graph;
  }

  // biome-ignore lint/style/useConsistentMemberAccessibility: check later
  public refresh() {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    // Only decorate component files (.tsx). Exclude plain .ts files.
    if (!uri.fsPath.toLowerCase().endsWith(".tsx")) {
      return;
    }
    const normalizedPath = path.resolve(uri.fsPath);
    const node = this.graph.nodes.get(normalizedPath);
    if (!node?.type) {
      return;
    }
    if (node.type === "client") {
      return {
        badge: typeIcon.client,
        tooltip: "Client Component",
        propagate: true,
      };
    }
    if (node.type === "universal") {
      return {
        badge: typeIcon.universal,
        tooltip: "Shared Component",
        propagate: true,
      };
    }
    // server/other: no badge
    return;
  }
}
