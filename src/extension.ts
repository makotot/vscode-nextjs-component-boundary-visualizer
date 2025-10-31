// biome-ignore lint/performance/noNamespaceImport: node:path cannot import with default import
import * as path from "node:path";
import { ComponentEnvGraph } from "@makotot/component-env-graph";
// biome-ignore lint/performance/noNamespaceImport: vscode cannot import with default import
import * as vscode from "vscode";
import { ClientComponentLineDecorator } from "./ui/clientComponentLineDecorator/index.js";
import { ClientComponentStatusBar } from "./ui/clientComponentStatusbar/index.js";
import { ComponentFileDecorationProvider } from "./ui/componentFileDecorationProvider/index.js";
import { JsxClientBoundaryLineDecorator } from "./ui/jsxClientBoundaryDecorator/index.js";

// Utility: debounce function (global)
function debounce<T extends (...args: vscode.Uri[]) => void>(
  fn: T,
  delay: number
): T {
  let timer: NodeJS.Timeout | undefined;
  return ((...args: vscode.Uri[]) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }

  // Get tsconfig path from settings (absolute or workspace-relative)
  const configPathSetting = vscode.workspace
    .getConfiguration("nextjsComponentBoundaryVisualizer")
    .get<string>("tsconfigPath");
  let tsConfigFilePath: string | undefined;
  if (configPathSetting) {
    tsConfigFilePath = path.isAbsolute(configPathSetting)
      ? configPathSetting
      : path.join(workspaceRoot, configPathSetting);
  }

  const graph = new ComponentEnvGraph(workspaceRoot, {
    tsConfigFilePath,
    exclude: vscode.workspace
      .getConfiguration("nextjsComponentBoundaryVisualizer")
      .get<string[]>("exclude"),
  });
  if (graph) {
    graph.build();
    new ClientComponentStatusBar(context, graph);

    // Instantiate the line decorator if enableLineIcon is true
    const config = vscode.workspace.getConfiguration(
      "nextjsComponentBoundaryVisualizer"
    );
    const enableLineIcon = config.get<boolean>("enableLineIcon");
    if (enableLineIcon) {
      new ClientComponentLineDecorator(context, graph);
    }

    // Always show end-of-line icons for JSX client boundaries in the active file
    new JsxClientBoundaryLineDecorator(context, graph);

    // Update the graph only once on file save/create/delete (debounced)
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.{ts,tsx}");
    const interval = 200;
    const debouncedBuild = debounce((uri: vscode.Uri) => {
      graph.build([uri.fsPath]);
    }, interval);
    watcher.onDidCreate(debouncedBuild);
    watcher.onDidChange(debouncedBuild);
    watcher.onDidDelete(debouncedBuild);
    context.subscriptions.push(watcher);

    // Also refresh the file decoration provider on graph update
    const decorationProvider = new ComponentFileDecorationProvider(graph);
    context.subscriptions.push(
      vscode.window.registerFileDecorationProvider(decorationProvider)
    );
    graph.onDidUpdate(() => decorationProvider.refresh());
  }
}
