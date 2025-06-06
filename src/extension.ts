// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DependencyGraph } from './core/dependencyGraph';
import { ComponentFileDecorationProvider } from './ui/componentFileDecorationProvider';
import { ClientComponentStatusBar } from './ui/clientComponentStatusbar';
import { ClientComponentLineDecorator } from './ui/clientComponentLineDecorator';
import * as path from 'path';

// Utility: debounce function (global)
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
	let timer: NodeJS.Timeout | undefined;
	return ((...args: any[]) => {
		if (timer) { clearTimeout(timer); }
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
	const configPathSetting = vscode.workspace.getConfiguration('nextjsComponentBoundaryVisualizer').get<string>('tsconfigPath');
	let tsConfigFilePath: string | undefined = undefined;
	if (configPathSetting) {
		tsConfigFilePath = path.isAbsolute(configPathSetting)
			? configPathSetting
			: path.join(workspaceRoot, configPathSetting);
	}

	const graph = new DependencyGraph(workspaceRoot, tsConfigFilePath);
	if (graph) {
		graph.build();
		new ClientComponentStatusBar(context, graph);
		new ClientComponentLineDecorator(context, graph);

		// Update the graph only once on file save/create/delete (debounced)
		const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx}');
		const debouncedBuild = debounce((uri: vscode.Uri) => {
			graph.build([uri.fsPath]);
		}, 200);
		watcher.onDidCreate(debouncedBuild);
		watcher.onDidChange(debouncedBuild);
		watcher.onDidDelete(debouncedBuild);
		context.subscriptions.push(watcher);

		// Also refresh the file decoration provider on graph update
		const decorationProvider = new ComponentFileDecorationProvider(graph);
		context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));
		graph.onDidUpdate(() => decorationProvider.refresh());
	}

	// Status bar and editor line decoration logic is in client-component-statusbar.ts and client-component-line-decorator.ts
}

// This method is called when your extension is deactivated
export function deactivate() {}
