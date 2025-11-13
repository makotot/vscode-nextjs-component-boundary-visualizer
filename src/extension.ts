// biome-ignore lint/performance/noNamespaceImport: vscode cannot import with default import
import * as vscode from "vscode";
import { isNextAppRouterProject } from "./core/isNextAppRouterProject/index.js";
import { resolveTsconfigPath } from "./core/resolveTsConfigFilePath/index.js";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }
  if (!isNextAppRouterProject(workspaceRoot)) {
    return;
  }
  await initialize(context, workspaceRoot);
}

async function initialize(
  context: vscode.ExtensionContext,
  workspaceRoot: string
) {
  try {
    const config = vscode.workspace.getConfiguration(
      "nextjsComponentBoundaryVisualizer"
    );

    const [{ ComponentEnvGraph }] = await Promise.all([
      import("@makotot/component-env-graph"),
    ]);

    const graph = new ComponentEnvGraph(workspaceRoot, {
      ...resolveTsconfigPath(workspaceRoot, config.get<string>("tsconfigPath")),
      exclude: config.get<string[]>("exclude"),
    });

    graph.build();

    const [{ ClientComponentStatusBar }, { ComponentFileDecorationProvider }] =
      await Promise.all([
        import("./ui/clientComponentStatusbar/index.js"),
        import("./ui/componentFileDecorationProvider/index.js"),
      ]);

    new ClientComponentStatusBar(context, graph);

    const enableLineIcon = config.get<boolean>("enableLineIcon");
    if (enableLineIcon) {
      const { ClientComponentLineDecorator } = await import(
        "./ui/clientComponentLineDecorator/index.js"
      );
      new ClientComponentLineDecorator(context, graph);
    }

    const { JsxClientBoundaryLineDecorator } = await import(
      "./ui/jsxClientBoundaryDecorator/index.js"
    );
    new JsxClientBoundaryLineDecorator(context, graph);

    const watcher = vscode.workspace.createFileSystemWatcher("**/*.{ts,tsx}");
    const interval = 200;
    const debouncedBuild = debounce((uri: vscode.Uri) => {
      graph.build([uri.fsPath]);
    }, interval);
    watcher.onDidCreate(debouncedBuild);
    watcher.onDidChange(debouncedBuild);
    watcher.onDidDelete(debouncedBuild);
    context.subscriptions.push(watcher);

    const decorationProvider = new ComponentFileDecorationProvider(graph);
    context.subscriptions.push(
      vscode.window.registerFileDecorationProvider(decorationProvider)
    );
    graph.onDidUpdate(() => decorationProvider.refresh());
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Initialization failed";
    vscode.window.showErrorMessage(
      `Next.js Component Boundary Visualizer: ${message}`
    );
  }
}

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
