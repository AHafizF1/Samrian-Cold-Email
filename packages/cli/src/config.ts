import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type CliConfig = {
  url?: string;
};

export function getConfigPath(
  input: {
    platform?: NodeJS.Platform;
    env?: Record<string, string | undefined>;
    home?: string;
  } = {}
) {
  const platform = input.platform ?? process.platform;
  const env = input.env ?? process.env;
  const home = input.home ?? homedir();
  const root =
    platform === "win32"
      ? (env.APPDATA ?? join(home, "AppData", "Roaming"))
      : (env.XDG_CONFIG_HOME ?? join(home, ".config"));
  return join(root, "samrian", "config.json");
}

export async function readConfig(path = getConfigPath()): Promise<CliConfig> {
  try {
    return parseConfig(await readFile(path, "utf8"));
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
}

export function readConfigSync(path = getConfigPath()): CliConfig {
  try {
    return parseConfig(readFileSync(path, "utf8"));
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
}

export async function writeConfig(path: string, config: CliConfig) {
  const value = config.url ? { url: new URL(config.url).origin } : {};
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function parseConfig(text: string): CliConfig {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid CLI config");
  const url = (value as Record<string, unknown>).url;
  if (url === undefined) return {};
  if (typeof url !== "string") throw new Error("Invalid CLI config URL");
  return { url: new URL(url).origin };
}

function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
