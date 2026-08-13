import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const publicRoutes = [
  /api[\\/]health[\\/]route\.ts$/,
  /api[\\/]unsubscribe[\\/]route\.ts$/,
  /api[\\/]track[\\/].*[\\/]route\.ts$/,
  /api[\\/]auth[\\/].*[\\/]route\.ts$/,
  /api[\\/]v1[\\/]openapi\.json[\\/]route\.ts$/,
];

describe("API security inventory", () => {
  test("classifies every route by explicit access mechanism", () => {
    const missing = routeFiles().filter((file) => {
      const source = readFileSync(resolve(file), "utf8");
      return !(
        source.includes("createApiRoute") ||
        source.includes("createSessionRoute") ||
        source.includes("createSessionAction") ||
        source.includes("requireOrgAccess") ||
        source.includes("serve({") ||
        publicRoutes.some((pattern) => pattern.test(file))
      );
    });
    expect(missing).toEqual([]);
  });

  test("public routes are narrow and intentional", () => {
    const publicFiles = routeFiles().filter((file) =>
      publicRoutes.some((pattern) => pattern.test(file))
    );
    expect(publicFiles.every((file) => /health|unsubscribe|track|auth|openapi/.test(file))).toBe(
      true
    );
  });
});

function routeFiles() {
  return readdirSync(resolve("src/app/api"), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith("route.ts"))
    .map((file) => `src/app/api/${file.replaceAll("\\", "/")}`);
}
