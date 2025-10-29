// biome-ignore lint/performance/noNamespaceImport: node:fs cannot import with default import
import * as fs from "node:fs";
// biome-ignore lint/performance/noNamespaceImport: node:os cannot import with default import
import * as os from "node:os";
// biome-ignore lint/performance/noNamespaceImport: node:path cannot import with default import
import * as path from "node:path";
import { ComponentEnvGraph } from "@makotot/component-env-graph";
import { describe, expect, test } from "vitest";
import { resolveJsxClientBoundary } from "./";

type Files = Record<string, string>;

function withTmpProject(files: Files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jsx-boundary-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

describe("resolveJsxClientBoundary", () => {
  type Case = {
    name: string;
    files: Files;
    entry: string;
    expectTag: string;
    expectBoundary: boolean | undefined;
    expectType?: "client" | "server" | "universal";
    expectFileEndsWith?: string;
  };

  const cases: Case[] = [
    {
      name: "server file rendering client component => boundary true",
      files: {
        "src/app/page.tsx": `import { Button } from './Button';
export default function Page() {
  return <Button />;
}`,
        "src/app/Button.tsx": `'use client'
export function Button(){ return <button type="button">OK</button>; }`,
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            jsx: "react-jsx",
            module: "ES2022",
            target: "ES2022",
            moduleResolution: "Bundler",
          },
          include: ["src"],
        }),
      },
      entry: "src/app/page.tsx",
      expectTag: "Button",
      expectBoundary: true,
      expectType: "client",
      expectFileEndsWith: "src/app/Button.tsx",
    },
    {
      name: "client file rendering client component => boundary false",
      files: {
        // client file
        "src/app/page.tsx": `'use client'
import { Button } from './Button';
export default function Page() {
  return <Button />;
}`,
        // client component
        "src/app/Button.tsx": `'use client'
export function Button(){ return <button type="button">OK</button>; }`,
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            jsx: "react-jsx",
            module: "ES2022",
            target: "ES2022",
            moduleResolution: "Bundler",
          },
          include: ["src"],
        }),
      },
      entry: "src/app/page.tsx",
      expectTag: "Button",
      expectBoundary: false,
      expectType: "client",
      expectFileEndsWith: "src/app/Button.tsx",
    },
    {
      name: "server file rendering server component => boundary false",
      files: {
        "src/app/page.tsx": `import { Title } from './Title';
export default function Page() {
  return <Title />;
}`,
        "src/app/Title.tsx":
          "export function Title(){ return <h1>Hello</h1>; }",
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            jsx: "react-jsx",
            module: "ES2022",
            target: "ES2022",
            moduleResolution: "Bundler",
          },
          include: ["src"],
        }),
      },
      entry: "src/app/page.tsx",
      expectTag: "Title",
      expectBoundary: false,
      expectType: "server",
      expectFileEndsWith: "src/app/Title.tsx",
    },
    {
      name: "intrinsic DOM tag is not resolved (no boundary fields)",
      files: {
        "src/app/page.tsx":
          "export default function Page() { return <div />; }",
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            jsx: "react-jsx",
            module: "ES2022",
            target: "ES2022",
            moduleResolution: "Bundler",
          },
          include: ["src"],
        }),
      },
      entry: "src/app/page.tsx",
      expectTag: "div",
      expectBoundary: undefined,
    },
  ];

  test.each(cases)("%s", (c) => {
    const { root, cleanup } = withTmpProject(c.files);
    try {
      const graph = new ComponentEnvGraph(root);
      graph.build();

      const filePath = path.join(root, c.entry);
      const out = resolveJsxClientBoundary(graph, filePath);

      const target = out.find((x) => x.tagName === c.expectTag);
      expect(target).toBeDefined();

      if (c.expectBoundary === undefined) {
        expect(target?.componentFile).toBeUndefined();
        expect(target?.componentEnv).toBeUndefined();
        expect(target?.boundary).toBeUndefined();
      } else {
        expect(target?.boundary).toBe(c.expectBoundary);
        if (c.expectType) {
          expect(target?.componentEnv).toBe(c.expectType);
        }
        if (c.expectFileEndsWith) {
          expect(target?.componentFile?.endsWith(c.expectFileEndsWith)).toBe(
            true
          );
        }
      }

      expect(Array.isArray(target?.range)).toBe(true);
      expect(typeof target?.range?.[0]).toBe("number");
      expect(typeof target?.range?.[1]).toBe("number");
    } finally {
      cleanup();
    }
  });
});
