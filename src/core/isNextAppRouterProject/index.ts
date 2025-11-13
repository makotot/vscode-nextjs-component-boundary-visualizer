// biome-ignore lint/performance/noNamespaceImport: node:fs cannot import with default import
import * as fs from "node:fs";
// biome-ignore lint/performance/noNamespaceImport: node:path cannot import with default import
import * as path from "node:path";

const NEXT_CONFIG_NAMES = new Set([
  "next.config.js",
  "next.config.ts",
  "next.config.mjs",
  "next.config.cjs",
]);

export function isNextAppRouterProject(rootDir: string): boolean {
  try {
    return scanForNextConfig(rootDir);
  } catch {
    return false;
  }
}

function scanForNextConfig(rootDir: string): boolean {
  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    const entries = safeReadDir(dir);
    if (!entries) {
      continue;
    }
    if (containsNextConfig(entries)) {
      return true;
    }
    for (const ent of entries) {
      if (!shouldDescend(ent, dir)) {
        continue;
      }
      stack.push(path.join(dir, ent.name));
    }
  }
  return false;
}

function safeReadDir(dir: string): fs.Dirent[] | null {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

function containsNextConfig(entries: fs.Dirent[]): boolean {
  for (const ent of entries) {
    if (ent.isFile() && NEXT_CONFIG_NAMES.has(ent.name)) {
      return true;
    }
  }
  return false;
}

function shouldDescend(ent: fs.Dirent, parentDir: string): boolean {
  if (!ent.isDirectory()) {
    return false;
  }
  if (ent.name === "node_modules" || ent.name === ".git") {
    return false;
  }
  try {
    const abs = path.join(parentDir, ent.name);
    return !fs.lstatSync(abs).isSymbolicLink();
  } catch {
    return false;
  }
}
