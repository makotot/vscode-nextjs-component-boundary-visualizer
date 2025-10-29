import type {
  ComponentEnvGraph,
  ComponentType,
} from "@makotot/component-env-graph";
import { SyntaxKind } from "ts-morph";

export type BoundaryResult = {
  range: [number, number];
  tagName: string;
  componentFile?: string;
  componentEnv?: ComponentType;
  boundary?: boolean;
};

type FilePathLike = string | { toString(): string };
type SourceFileLike = { getFilePath?: () => FilePathLike };
type DeclarationLike = { getSourceFile?: () => SourceFileLike | undefined };
type SymbolLike = {
  getAliasedSymbol?: () => SymbolLike | undefined;
  getDeclarations?: () => readonly DeclarationLike[] | undefined;
};
type TagLike = { getSymbol?: () => SymbolLike | undefined };

/**
 * Resolves the JSX client boundary for a given file.
 * @param graph - The component environment graph.
 * @param filePath - The path to the file to resolve.
 * @returns An array of boundary results.
 */
export function resolveJsxClientBoundary(
  graph: ComponentEnvGraph,
  filePath: string
): BoundaryResult[] {
  const sourceFile = graph.project.getSourceFile(filePath);
  if (!sourceFile) {
    return [];
  }

  const targetFileComponentEnv = graph.nodes.get(filePath)?.type;
  const results: BoundaryResult[] = [];

  const openings = sourceFile.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement
  );
  const selfClosings = sourceFile.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement
  );
  const nodes = [...openings, ...selfClosings];

  for (const node of nodes) {
    const tag = node.getTagNameNode();
    const tagName = tag.getText();
    const range: [number, number] = [node.getStart(), node.getEnd()];

    const intrinsic = resolveIntrinsicElement(range, tagName);
    if (intrinsic) {
      results.push(intrinsic);
      continue;
    }

    const componentFile = resolveTagToFile(graph, tag);
    if (!componentFile) {
      results.push({ range, tagName, boundary: false });
      continue;
    }

    const componentEnv = graph.nodes.get(componentFile)?.type;
    const boundary = !!(
      targetFileComponentEnv !== "client" && componentEnv === "client"
    );

    const item: BoundaryResult = { range, tagName, boundary };
    if (componentFile) {
      item.componentFile = componentFile;
    }
    if (componentEnv) {
      item.componentEnv = componentEnv;
    }
    results.push(item);
  }

  return results;
}

const INTRINSIC_TAG_REGEX = /^[a-z]/;
/**
 * Resolves an intrinsic element. ex: <div />, <span />
 * @param range - The range of the element.
 * @param tagName - The name of the element.
 * @returns The resolved intrinsic element or undefined.
 */
function resolveIntrinsicElement(
  range: [number, number],
  tagName: string
): BoundaryResult | undefined {
  if (INTRINSIC_TAG_REGEX.test(tagName)) {
    return { range, tagName };
  }
  return;
}

/**
 * Resolves a JSX tag node to a project file path if possible.
 * Obtains the tag's symbol and delegates to resolveSymbolToFile.
 *
 * @param graph - The component environment graph.
 * @param tag - The JSX tag node.
 * @returns The resolved file path or undefined if cannot be resolved as a project file.
 */
function resolveTagToFile(
  graph: ComponentEnvGraph,
  tag: TagLike
): string | undefined {
  const symbol = tag?.getSymbol?.();
  if (!symbol) {
    return;
  }
  return resolveSymbolToFile(graph, symbol);
}

/**
 * Resolves a symbol (following import aliases) to a project file path.
 * Prefers the aliased symbol's declarations, then falls back to own declarations.
 */
function resolveSymbolToFile(
  graph: ComponentEnvGraph,
  symbol: SymbolLike | undefined
): string | undefined {
  const fromAliased = getFirstKnownDeclPath(
    graph,
    symbol?.getAliasedSymbol?.()?.getDeclarations?.()
  );
  if (fromAliased) {
    return fromAliased;
  }
  return getFirstKnownDeclPath(graph, symbol?.getDeclarations?.());
}

/**
 * From a list of declarations, returns the first file path that is inside the project graph
 * (non-node_modules and present in graph.nodes).
 */
function getFirstKnownDeclPath(
  graph: ComponentEnvGraph,
  decls: readonly DeclarationLike[] | undefined
): string | undefined {
  for (const decl of decls || []) {
    const filePath = toPathString(decl?.getSourceFile?.()?.getFilePath?.());
    if (!filePath) {
      continue;
    }
    if (filePath.includes("node_modules")) {
      continue;
    }
    if (!graph.nodes.has(filePath)) {
      continue;
    }
    return filePath;
  }
  return;
}

function toPathString(filePath: FilePathLike | undefined): string | undefined {
  if (!filePath) {
    return;
  }
  if (typeof filePath === "string") {
    return filePath;
  }
  const filePathString = filePath.toString?.();

  return typeof filePathString === "string" ? filePathString : undefined;
}
