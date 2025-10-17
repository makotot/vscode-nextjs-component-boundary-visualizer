# Next.js Component Boundary Visualizer

Visualizes and distinguishes between server, client, and universal components in Next.js App Router projects. This extension provides visual cues in the VS Code explorer, status bar, and editor to help you understand the component boundaries in your Next.js App Router codebase.

![Screenshot](assets/screenshot.png)

---

**Extension ID:** `vscode-nextjs-component-boundary-visualizer`

You can install this extension by searching for "Next.js Component Boundary Visualizer" or using the extension ID above in the VS Code Extensions view.

---

## Features

- **Explorer Badges**: Shows icons for client and universal components in the file explorer.
- **Status Bar**: Displays the type of the currently open component (client, server, universal).
- **Line Decorations**: Adds a colored line and icon to the editor for client and universal components.
- **Automatic Updates**: Watches for file changes and updates the visualization in real time.

## Requirements

- VS Code 1.100.0 or later
- A Next.js project using the App Router (TypeScript projects are supported; all `.ts` and `.tsx` files are analyzed for component boundaries, except for config, d.ts, test, spec, stories, and `__mocks__` files)
- A `tsconfig.json` file must exist at the project root (or specify its path via extension settings)

## Usage

Open a Next.js App Router project in VS Code. The extension will automatically analyze your files and display component type information in the explorer, status bar, and editor.

If your `tsconfig.json` is not at the project root, set the path in your VS Code settings:

```json
"nextjsComponentBoundaryVisualizer.tsconfigPath": "path/to/your/tsconfig.json"
```

## Extension Settings

- `nextjsComponentBoundaryVisualizer.tsconfigPath`: Path to `tsconfig.json` (absolute or workspace-relative). If empty, `<project root>/tsconfig.json` is used.
- `nextjsComponentBoundaryVisualizer.enableLineIcon`: Enable/disable the icon at the beginning of the line. Defaults to false.

## Icons

- **Client Component**: `⚡️`
- **Universal Component**: `♾️`
- **Server Component**: No icon (server components do not display a badge or icon)

These icons appear in the file explorer, status bar, and as line decorations in the editor to help you quickly distinguish component types. Note: visual decorations are applied only to `.tsx` files (component files). Plain `.ts` files are analyzed for dependency/type classification but are not decorated.

## Known Issues

- Only supports projects using the App Router structure.
- Does not support legacy Next.js pages directory.
- Only `.ts` and `.tsx` files are analyzed for component boundaries (excluding config, d.ts, test, spec, stories, and `__mocks__` files; `.js`/`.jsx` are not supported).
- Visual decorations (explorer badges, status bar, and line icons) are shown only for `.tsx` files. `.ts` files are excluded from icon display because they are not React component files.
- The extension will not work if `tsconfig.json` is missing or misconfigured.
- Does not analyze dynamic imports; only static imports and re-exports are considered for dependency graph and component type classification.

## Related Extensions

- [Next.js Server Functions Visualizer](https://marketplace.visualstudio.com/items?itemName=makotot.nextjs-server-functions-visualizer)
- [Next.js RSC Boundary Pack](https://marketplace.visualstudio.com/items?itemName=makotot.nextjs-rsc-boundary-pack)
