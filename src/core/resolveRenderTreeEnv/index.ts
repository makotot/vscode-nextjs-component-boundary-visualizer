import type {
  ComponentEnvGraph,
  ComponentType,
} from "@makotot/component-env-graph";
import { SyntaxKind } from "ts-morph";

export type RenderTreeEnvRole =
  | "server-to-client-boundary"
  | "composed-server-in-client";

export type RenderTreeEnvResult = {
  range: [number, number];
  tagName: string;
  componentFile?: string;
  componentEnv?: ComponentType;
  role?: RenderTreeEnvRole;
};

type FilePathLike = string | { toString(): string };
type SourceFileLike = { getFilePath?: () => FilePathLike };
type DeclarationLike = { getSourceFile?: () => SourceFileLike | undefined };
type SymbolLike = {
  getAliasedSymbol?: () => SymbolLike | undefined;
  getDeclarations?: () => readonly DeclarationLike[] | undefined;
};
type TagLike = { getSymbol?: () => SymbolLike | undefined };
type AncestorNode = {
  getKind: () => SyntaxKind;
  getOpeningElement?: () => { getTagNameNode: () => TagLike };
  getTagNameNode?: () => TagLike;
};

export function resolveRenderTreeEnv(
  graph: ComponentEnvGraph,
  filePath: string
): RenderTreeEnvResult[] {
  const sourceFile = graph.project.getSourceFile(filePath);
  if (!sourceFile) {
    return [];
  }

  const targetFileComponentEnv = graph.nodes.get(filePath)?.type;
  const results: RenderTreeEnvResult[] = [];

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
      results.push({ range, tagName });
      continue;
    }

    const componentEnv = graph.nodes.get(componentFile)?.type;
    const role = resolveRole(targetFileComponentEnv, componentEnv, graph, node);

    const item: RenderTreeEnvResult = { range, tagName, componentFile };
    if (componentEnv) {
      item.componentEnv = componentEnv;
    }
    if (role) {
      item.role = role;
    }
    results.push(item);
  }

  return results;
}

const INTRINSIC_TAG_REGEX = /^[a-z]/;

function resolveIntrinsicElement(
  range: [number, number],
  tagName: string
): RenderTreeEnvResult | undefined {
  if (INTRINSIC_TAG_REGEX.test(tagName)) {
    return { range, tagName };
  }
  return;
}

type NodeLike = {
  getKind: () => SyntaxKind;
  getParent: () => { getAncestors: () => AncestorNode[] };
  getAncestors: () => AncestorNode[];
};

function resolveRole(
  targetFileComponentEnv: ComponentType | undefined,
  componentEnv: ComponentType | undefined,
  graph: ComponentEnvGraph,
  node: NodeLike
): RenderTreeEnvRole | undefined {
  if (targetFileComponentEnv !== "client" && componentEnv === "client") {
    return "server-to-client-boundary";
  }
  if (componentEnv !== "client" && isComposedInClientComponent(graph, node)) {
    return "composed-server-in-client";
  }
}

function isComposedInClientComponent(
  graph: ComponentEnvGraph,
  node: NodeLike
): boolean {
  // For JsxOpeningElement, start from the parent JsxElement to avoid matching itself
  const ancestors =
    node.getKind() === SyntaxKind.JsxOpeningElement
      ? node.getParent().getAncestors()
      : node.getAncestors();

  for (const ancestor of ancestors) {
    let tag: TagLike | undefined;
    if (ancestor.getKind() === SyntaxKind.JsxElement) {
      tag = ancestor.getOpeningElement?.().getTagNameNode();
    } else if (ancestor.getKind() === SyntaxKind.JsxSelfClosingElement) {
      tag = ancestor.getTagNameNode?.();
    }

    if (!tag) {
      continue;
    }

    const file = resolveTagToFile(graph, tag);
    if (!file) {
      // Intrinsic or unresolvable — skip and continue up
      continue;
    }

    const env = graph.nodes.get(file)?.type;
    if (env === "client") {
      return true;
    }
    // Nearest resolvable ancestor is server/universal — not composed in client
    return false;
  }

  return false;
}

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
