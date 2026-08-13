import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import { createRunId, getScanPlan, runSecurity, SECURITY_MODES } from "../../scripts/security/run";
import { assertDisposableDatabase } from "../../scripts/security/seed";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "samrian-security-"));

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("security runner", () => {
  it("defines every package security mode", () => {
    expect(SECURITY_MODES).toEqual(["semgrep", "gitleaks", "trivy", "schemathesis", "audit"]);
  });

  it("creates stable scan run ids", () => {
    expect(createRunId(() => "123e4567-e89b-12d3-a456-426614174000")).toBe(
      "sec_123e4567-e89b-12d3-a456-426614174000"
    );
  });

  it("rejects unknown modes before spawning", async () => {
    const spawn = vi.fn();
    await expect(
      runSecurity({ mode: "unknown", root, env: {}, spawn, dryRun: true })
    ).rejects.toThrow("Unknown security scan mode: unknown");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("builds dry-run plans without exposing secrets", () => {
    const secret = "samrian_secret_value";
    const plan = getScanPlan({
      mode: "schemathesis",
      root,
      runId: "sec_test",
      env: {
        SECURITY_BASE_URL: "http://host.docker.internal:3000",
        SAMRIAN_TOKEN: secret,
      },
    });
    const serialized = JSON.stringify(plan);

    expect(serialized).not.toContain(secret);
    expect(serialized).toContain("SAMRIAN_TOKEN");
    expect(plan.reportDir).toContain(path.join("security", "reports", "sec_test"));
  });

  it("excludes generated dependency trees from Trivy filesystem scans", () => {
    const plan = getScanPlan({ mode: "trivy", root, runId: "sec_test", env: {} });
    const command = plan.command.join(" ");

    expect(command).toContain("--skip-dirs /workspace/node_modules");
    expect(command).toContain("--skip-dirs /workspace/.next");
    expect(command).toContain("--skip-dirs /workspace/security/reports");
    expect(command).toContain("--skip-dirs /workspace/.git");
    expect(command).toContain("--skip-dirs /workspace/dist");
    expect(command).toContain("--skip-dirs /workspace/coverage");
    expect(command).toContain("samrian-trivy-cache:/root/.cache");
  });

  it("rejects schemathesis against production", () => {
    expect(() =>
      getScanPlan({
        mode: "schemathesis",
        root,
        runId: "sec_test",
        env: {
          SECURITY_BASE_URL: "https://app.samrian.example",
          SECURITY_ENVIRONMENT: "production",
          SAMRIAN_TOKEN: "secret",
        },
      })
    ).toThrow("Mutation-capable security scans cannot target production");
  });

  it("reports missing env names without values", () => {
    expect(() =>
      getScanPlan({
        mode: "schemathesis",
        root,
        runId: "sec_test",
        env: { SECURITY_BASE_URL: "http://host.docker.internal:3000" },
      })
    ).toThrow("Missing security environment variables: SAMRIAN_TOKEN");
  });

  it("fails scanner execution errors", async () => {
    await expect(
      runSecurity({
        mode: "semgrep",
        root,
        env: {},
        spawn: async () => 125,
      })
    ).rejects.toThrow("semgrep scanner failed with exit code 125");
  });

  it("fails confirmed gitleaks findings", async () => {
    await expect(
      runSecurity({
        mode: "gitleaks",
        root,
        env: {},
        spawn: async () => 1,
      })
    ).rejects.toThrow("Gitleaks found potential secrets");
  });

  it("keeps non-secret scanner findings in triage mode", async () => {
    await expect(
      runSecurity({
        mode: "trivy",
        root,
        env: {},
        spawn: async () => 1,
      })
    ).resolves.toMatchObject({ status: "findings", exitCode: 1 });
  });

  it("refuses to seed databases without disposable name and marker", () => {
    expect(() =>
      assertDisposableDatabase(
        "postgres://postgres:postgres@localhost:5432/samrian",
        "I_UNDERSTAND_THIS_DATA_IS_DISPOSABLE"
      )
    ).toThrow("database named with 'security'");
    expect(() =>
      assertDisposableDatabase("postgres://localhost/samrian_security", undefined)
    ).toThrow("SECURITY_DISPOSABLE");
  });
});
