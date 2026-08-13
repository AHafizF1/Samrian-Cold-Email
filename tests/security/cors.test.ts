import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("CORS policy", () => {
  test("does not expose credentialed wildcard origins", () => {
    const sources = [
      ...readdirSync(resolve("src"), { recursive: true })
        .map(String)
        .filter((file) => file.endsWith(".ts"))
        .map((file) => `src/${file.replaceAll("\\", "/")}`),
      "next.config.ts",
    ]
      .map((file) => readFileSync(resolve(file), "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/access-control-allow-origin["'\s:,*]+["']?\*/i);
    expect(sources).not.toMatch(/Access-Control-Allow-Credentials["'\s:]+true/i);
  });
});
