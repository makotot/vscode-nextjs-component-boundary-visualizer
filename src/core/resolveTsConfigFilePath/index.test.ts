// biome-ignore lint/performance/noNamespaceImport: node:path cannot import with default import
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import { resolveTsconfigPath } from "./index.js";

describe("resolveTsconfigPath", () => {
  type Case = {
    name: string;
    root: string;
    setting: string | undefined;
    expected: { tsConfigFilePath: string } | undefined;
  };

  const ROOT = "/project/root";
  const ABS = path.join(path.sep, "x", "y", "tsconfig.json");

  const cases: Case[] = [
    {
      name: "undefined setting returns undefined",
      root: ROOT,
      setting: undefined,
      expected: undefined,
    },
    {
      name: "empty string returns undefined",
      root: ROOT,
      setting: "",
      expected: undefined,
    },
    {
      name: "relative path resolves against workspace root",
      root: ROOT,
      setting: "configs/tsconfig.json",
      expected: { tsConfigFilePath: path.join(ROOT, "configs/tsconfig.json") },
    },
    {
      name: "absolute path is kept as-is",
      root: ROOT,
      setting: ABS,
      expected: { tsConfigFilePath: ABS },
    },
  ];

  test.each(cases)("%s", (c) => {
    const out = resolveTsconfigPath(c.root, c.setting);
    expect(out).toEqual(c.expected);
  });
});
