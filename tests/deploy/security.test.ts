import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

describe("security workflow deployment files", () => {
  it("tracks declarative scanner configs and report placeholder", () => {
    for (const file of [
      "security/semgrep/config.yaml",
      "security/reports/.gitkeep",
      "docker-compose.security.yml",
    ]) {
      expect(fs.existsSync(path.join(root, file)), file).toBe(true);
    }
  });

  it("documents pinned official scanner images", () => {
    const source = fs.readFileSync(path.join(root, "scripts/security/run.ts"), "utf8");
    expect(source).not.toMatch(/zaproxy|zap-/i);
    expect(source).toContain("semgrep/semgrep:");
    expect(source).toContain("zricethezav/gitleaks:");
    expect(source).toContain("aquasec/trivy:");
    expect(source).toContain("schemathesis/schemathesis:");
    expect(source).not.toMatch(/:latest["']/);
  });

  it("ignores generated reports but keeps placeholder", () => {
    const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(gitignore).toContain("/security/reports/*");
    expect(gitignore).toContain("!/security/reports/.gitkeep");
  });

  it("exposes all security scripts", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const name of [
      "security:semgrep",
      "security:gitleaks",
      "security:trivy",
      "security:schemathesis",
      "security:audit",
    ]) {
      expect(pkg.scripts[name], name).toBeTruthy();
    }
    expect(Object.keys(pkg.scripts)).not.toContainEqual(expect.stringMatching(/^security:zap/));
  });

  it("contains no ZAP integration residue", () => {
    const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");
    const runner = fs.readFileSync(path.join(root, "scripts/security/run.ts"), "utf8");
    const workflow = fs.readFileSync(path.join(root, "docs", "SECURITY_WORKFLOW.md"), "utf8");

    expect([pkg, runner, workflow].join("\n")).not.toMatch(
      /zaproxy|security:zap|security\/zap|OWASP ZAP|\bZAP\b/i
    );
    expect(fs.existsSync(path.join(root, "security", "zap"))).toBe(false);
  });

  it("copies workspace packages before frozen install", () => {
    const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("COPY packages ./packages");
    expect(dockerfile.indexOf("COPY packages ./packages")).toBeLessThan(
      dockerfile.indexOf("RUN bun install --frozen-lockfile")
    );
  });

  it("runs production container as a non-root user", () => {
    const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/\nUSER bun\n/);
  });

  it("pins direct security-sensitive dependencies above audited versions", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies.next).toBe("16.3.0");
    expect(pkg.dependencies["better-auth"]).toBe("1.6.27");
    expect(pkg.dependencies["@better-auth/api-key"]).toBe("1.6.27");
    expect(pkg.dependencies.nodemailer).toBe("9.0.5");
    expect(pkg.dependencies.imapflow).toBe("1.7.0");
  });

  it("makes Semgrep return a finding-aware exit code", () => {
    const source = fs.readFileSync(path.join(root, "scripts/security/run.ts"), "utf8");
    expect(source).toMatch(/"semgrep",\s*"scan",\s*"--error"/);
  });

  it("documents and exposes data protection operations", () => {
    const lifecycle = fs.readFileSync(path.join(root, "docs", "DATA_LIFECYCLE.md"), "utf8");
    const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    for (const section of ["Classification", "Transit", "At Rest", "In Use", "Retention"]) {
      expect(lifecycle).toContain(section);
    }
    expect(env).toContain("CREDENTIAL_ACTIVE_KEY_ID");
    expect(env).toContain("CREDENTIAL_KEYS_JSON");
    expect(env).toContain("S3_SERVER_SIDE_ENCRYPTION");
    expect(pkg.scripts["crypto:rotate"]).toBeTruthy();
    expect(pkg.scripts["data:audit"]).toBeTruthy();
  });
});
