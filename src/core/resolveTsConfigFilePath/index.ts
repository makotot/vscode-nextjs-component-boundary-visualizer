// biome-ignore lint/performance/noNamespaceImport: node:path cannot import with default import
import * as path from "node:path";

export function resolveTsconfigPath(
  workspaceRoot: string,
  configPathSetting: string | undefined
): {
  tsConfigFilePath?: string;
} {
  if (!configPathSetting) {
    return {};
  }
  const tsConfigFilePath = path.isAbsolute(configPathSetting)
    ? configPathSetting
    : path.join(workspaceRoot, configPathSetting);

  return { tsConfigFilePath };
}
