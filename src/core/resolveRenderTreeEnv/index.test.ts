// biome-ignore lint/performance/noNamespaceImport: node:fs cannot import with default import
import * as fs from "node:fs";
// biome-ignore lint/performance/noNamespaceImport: node:os cannot import with default import
import * as os from "node:os";
// biome-ignore lint/performance/noNamespaceImport: node:path cannot import with default import
import * as path from "node:path";
import { ComponentEnvGraph } from "@makotot/component-env-graph";
import { describe, expect, test } from "vitest";
import type { RenderTreeEnvRole } from "./";
import { resolveRenderTreeEnv } from "./";

type Files = Record<string, string>;

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    jsx: "react-jsx",
    module: "ES2022",
    target: "ES2022",
    moduleResolution: "Bundler",
  },
  include: ["src"],
});

function withTmpProject(files: Files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "render-tree-env-"));
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

describe("resolveRenderTreeEnv", () => {
  type Case = {
    name: string;
    files: Files;
    entry: string;
    expectTag: string;
    expectRole: RenderTreeEnvRole | undefined;
    expectIntrinsic?: boolean;
    expectType?: "client" | "server" | "universal";
    expectFileEndsWith?: string;
  };

  const cases: Case[] = [
    {
      name: "server file rendering client component => server-to-client-boundary",
      files: {
        "src/app/page.tsx": `import { Button } from './Button';
export default function Page() {
  return <Button />;
}`,
        "src/app/Button.tsx": `'use client'
export function Button(){ return <button type="button">OK</button>; }`,
        "tsconfig.json": TSCONFIG,
      },
      entry: "src/app/page.tsx",
      expectTag: "Button",
      expectRole: "server-to-client-boundary",
      expectType: "client",
      expectFileEndsWith: "src/app/Button.tsx",
    },
    {
      name: "client file rendering client component => no role",
      files: {
        "src/app/page.tsx": `'use client'
import { Button } from './Button';
export default function Page() {
  return <Button />;
}`,
        "src/app/Button.tsx": `'use client'
export function Button(){ return <button type="button">OK</button>; }`,
        "tsconfig.json": TSCONFIG,
      },
      entry: "src/app/page.tsx",
      expectTag: "Button",
      expectRole: undefined,
      expectType: "client",
      expectFileEndsWith: "src/app/Button.tsx",
    },
    {
      name: "server file rendering server component => no role",
      files: {
        "src/app/page.tsx": `import { Title } from './Title';
export default function Page() {
  return <Title />;
}`,
        "src/app/Title.tsx":
          "export function Title(){ return <h1>Hello</h1>; }",
        "tsconfig.json": TSCONFIG,
      },
      entry: "src/app/page.tsx",
      expectTag: "Title",
      expectRole: undefined,
      expectType: "server",
      expectFileEndsWith: "src/app/Title.tsx",
    },
    {
      name: "intrinsic DOM tag => no componentFile/componentEnv/role",
      files: {
        "src/app/page.tsx":
          "export default function Page() { return <div />; }",
        "tsconfig.json": TSCONFIG,
      },
      entry: "src/app/page.tsx",
      expectTag: "div",
      expectRole: undefined,
      expectIntrinsic: true,
    },
    {
      name: "server component as children of client component => composed-server-in-client",
      files: {
        "src/app/page.tsx": `import { ClientWrapper } from './ClientWrapper';
import { ServerContent } from './ServerContent';
export default function Page() {
  return (
    <ClientWrapper>
      <ServerContent />
    </ClientWrapper>
  );
}`,
        "src/app/ClientWrapper.tsx": `'use client'
export function ClientWrapper(props: { children: unknown }) {
  return <div>{props.children as any}</div>;
}`,
        "src/app/ServerContent.tsx":
          "export function ServerContent() { return <p>server</p>; }",
        "tsconfig.json": TSCONFIG,
      },
      entry: "src/app/page.tsx",
      expectTag: "ServerContent",
      expectRole: "composed-server-in-client",
      expectType: "server",
      expectFileEndsWith: "src/app/ServerContent.tsx",
    },
    {
      name: "server component as named prop of client component => composed-server-in-client",
      files: {
        "src/app/page.tsx": `import { ClientWrapper } from './ClientWrapper';
import { ServerHeader } from './ServerHeader';
export default function Page() {
  return <ClientWrapper header={<ServerHeader />} />;
}`,
        "src/app/ClientWrapper.tsx": `'use client'
export function ClientWrapper(props: { header: unknown }) {
  return <div>{props.header as any}</div>;
}`,
        "src/app/ServerHeader.tsx":
          "export function ServerHeader() { return <header>Header</header>; }",
        "tsconfig.json": TSCONFIG,
      },
      entry: "src/app/page.tsx",
      expectTag: "ServerHeader",
      expectRole: "composed-server-in-client",
      expectType: "server",
      expectFileEndsWith: "src/app/ServerHeader.tsx",
    },
    {
      name: "client component inside client component children => server-to-client-boundary (not composed-server-in-client)",
      files: {
        "src/app/page.tsx": `import { ClientWrapper } from './ClientWrapper';
import { AnotherClient } from './AnotherClient';
export default function Page() {
  return (
    <ClientWrapper>
      <AnotherClient />
    </ClientWrapper>
  );
}`,
        "src/app/ClientWrapper.tsx": `'use client'
export function ClientWrapper(props: { children: unknown }) {
  return <div>{props.children as any}</div>;
}`,
        "src/app/AnotherClient.tsx": `'use client'
export function AnotherClient() { return <span>client</span>; }`,
        "tsconfig.json": TSCONFIG,
      },
      entry: "src/app/page.tsx",
      expectTag: "AnotherClient",
      expectRole: "server-to-client-boundary",
      expectType: "client",
      expectFileEndsWith: "src/app/AnotherClient.tsx",
    },
    {
      name: "server component nested inside server component inside client => nearest ancestor is server => no role",
      files: {
        "src/app/page.tsx": `import { ClientWrapper } from './ClientWrapper';
import { ServerWrapper } from './ServerWrapper';
import { ServerContent } from './ServerContent';
export default function Page() {
  return (
    <ClientWrapper>
      <ServerWrapper>
        <ServerContent />
      </ServerWrapper>
    </ClientWrapper>
  );
}`,
        "src/app/ClientWrapper.tsx": `'use client'
export function ClientWrapper(props: { children: unknown }) {
  return <div>{props.children as any}</div>;
}`,
        "src/app/ServerWrapper.tsx": `export function ServerWrapper(props: { children: unknown }) {
  return <section>{props.children as any}</section>;
}`,
        "src/app/ServerContent.tsx":
          "export function ServerContent() { return <p>server</p>; }",
        "tsconfig.json": TSCONFIG,
      },
      entry: "src/app/page.tsx",
      expectTag: "ServerContent",
      expectRole: undefined,
      expectType: "server",
      expectFileEndsWith: "src/app/ServerContent.tsx",
    },
  ];

  test.each(cases)("$name", (c) => {
    const { root, cleanup } = withTmpProject(c.files);
    try {
      const graph = new ComponentEnvGraph(root);
      graph.build();

      const filePath = path.join(root, c.entry);
      const out = resolveRenderTreeEnv(graph, filePath);

      const target = out.find((x) => x.tagName === c.expectTag);
      expect(target).toBeDefined();

      expect(target?.role).toBe(c.expectRole);

      if (c.expectIntrinsic) {
        expect(target?.componentFile).toBeUndefined();
        expect(target?.componentEnv).toBeUndefined();
      } else {
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
