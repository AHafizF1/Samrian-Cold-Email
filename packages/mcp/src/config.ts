export type McpMode = "read-only" | "operator";

export type McpConfig = {
  mode: McpMode;
  token: string;
  url: string;
};

export function getMcpConfig(env: Record<string, string | undefined>): McpConfig {
  const missing = ["SAMRIAN_URL", "SAMRIAN_TOKEN"].filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing MCP environment: ${missing.join(", ")}`);

  const mode = env.MCP_MODE?.trim() || "read-only";
  if (mode !== "read-only" && mode !== "operator") {
    throw new Error("MCP_MODE must be read-only or operator");
  }

  return {
    mode,
    token: env.SAMRIAN_TOKEN!.trim(),
    url: validateBaseUrl(env.SAMRIAN_URL!.trim()),
  };
}
import { validateBaseUrl } from "@samrian/sdk";
