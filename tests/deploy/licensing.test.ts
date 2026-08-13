import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const root = process.cwd();
const permissivePackages = ["contracts", "sdk", "cli", "mcp"] as const;
const forbiddenPackageImports = [
  "@/server/",
  "src/server/",
  "drizzle-orm",
  "bullmq",
  "inngest",
  "@workos-inc/",
  "better-auth",
];

function read(file: string) {
  return readFileSync(path.join(root, file), "utf8");
}

function sha256(file: string) {
  return createHash("sha256")
    .update(readFileSync(path.join(root, file)))
    .digest("hex");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? sourceFiles(file) : file.endsWith(".ts") ? [file] : [];
  });
}

describe("hybrid licensing", () => {
  test("declares AGPL for application and MIT for public tooling", () => {
    const rootPackage = JSON.parse(read("package.json")) as { license?: string };

    expect(rootPackage.license).toBe("AGPL-3.0-or-later");
    const rootLicense = read("LICENSE");
    expect(rootLicense).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
    expect(rootLicense).not.toContain("Samrian");
    expect(sha256("LICENSE")).toBe(
      "0da032ca2dabfbd5f5cd67e1fd28499b7b17bb90f066c9a656e7678a7fc3d7e4"
    );

    for (const packageName of permissivePackages) {
      const manifest = JSON.parse(read(`packages/${packageName}/package.json`)) as {
        license?: string;
      };
      expect(manifest.license).toBe("MIT");
      expect(read(`packages/${packageName}/LICENSE`)).toContain(
        "Permission is hereby granted, free of charge"
      );
      expect(read(`packages/${packageName}/LICENSE`)).not.toContain(
        "GNU AFFERO GENERAL PUBLIC LICENSE"
      );
      expect(sha256(`packages/${packageName}/LICENSE`)).toBe(
        "5bda8ed9ed42429a8db781e55d3b5388c2a253228d9bf4f60a1c997a8b7ac8a4"
      );
    }
  });

  test("documents component boundaries, source access, and trademark separation", () => {
    expect(read("LICENSING.md")).toContain("AGPL-3.0-or-later");
    expect(read("LICENSING.md")).toContain("packages/sdk");
    expect(read("TRADEMARKS.md")).toContain("based on Samrian");
    expect(read("README.md")).toContain("LICENSING.md");
    expect(read(".env.example")).toContain("NEXT_PUBLIC_SOURCE_URL");

    const sidebar = read("src/components/app-sidebar.tsx");
    expect(sidebar).toContain("NEXT_PUBLIC_SOURCE_URL");
    expect(sidebar).toContain("Source");
    expect(sidebar).toContain("License");
    expect(read("Dockerfile")).toContain("/app/LICENSE");
    expect(read("Dockerfile")).toContain("/app/LICENSING.md");
    expect(read("Dockerfile")).toContain("/app/NOTICE");
    expect(read("CONTRIBUTING.md")).toContain("applicable component license");
  });

  test("keeps permissive packages independent from AGPL server implementation", () => {
    const violations = permissivePackages.flatMap((packageName) =>
      sourceFiles(path.join(root, "packages", packageName, "src")).flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return forbiddenPackageImports
          .filter((value) => source.includes(value))
          .map((value) => `${path.relative(root, file)} imports ${value}`);
      })
    );

    expect(violations).toEqual([]);
  });

  test("includes license in publishable MCP artifacts", () => {
    const manifest = JSON.parse(read("packages/mcp/package.json")) as { files?: string[] };

    expect(manifest.files).toContain("LICENSE");
    expect(existsSync(path.join(root, "packages/mcp/LICENSE"))).toBe(true);
  });
});
