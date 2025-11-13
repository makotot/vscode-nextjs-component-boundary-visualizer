// biome-ignore lint/performance/noNamespaceImport: node:fs cannot import with default import
import * as fs from "node:fs";
// biome-ignore lint/performance/noNamespaceImport: node:os cannot import with default import
import * as os from "node:os";
// biome-ignore lint/performance/noNamespaceImport: node:path cannot import with default import
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import { isNextAppRouterProject } from "./index.js";

describe("isNextAppRouterProject", () => {
  type Case = {
    name: string;
    dirs: string[];
    files: Record<string, string>;
    expected: boolean;
  };

  const cases: Case[] = [
    {
      name: "no next.config.* => false",
      dirs: ["src"],
      files: {},
      expected: false,
    },
    {
      name: "root next.config.js => true",
      dirs: [],
      files: { "next.config.js": "module.exports = {}" },
      expected: true,
    },
    {
      name: "nested next.config.mjs => true",
      dirs: [],
      files: {
        "packages/site/next.config.mjs": "export default {}",
        "node_modules/next.config.js": "module.exports = {}",
      },
      expected: true,
    },
    {
      name: "only node_modules with next.config.ts => false",
      dirs: ["node_modules/some-package"],
      files: { "node_modules/next.config.ts": "export = {}" },
      expected: false,
    },
  ];

  test.each(cases)("%s", (c) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "next-check-"));
    for (const d of c.dirs) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
    }
    for (const [rel, content] of Object.entries(c.files)) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    try {
      expect(isNextAppRouterProject(root)).toBe(c.expected);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
