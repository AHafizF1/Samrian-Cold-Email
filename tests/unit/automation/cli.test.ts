import { getOutputMode } from "../../../packages/cli/src";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("CLI safety", () => {
  it("defaults piped output to JSON", () => {
    expect(getOutputMode({ isTTY: false })).toBe("json");
  });

  it("rejects unknown auth commands before making a request", () => {
    const result = spawnSync("bun", ["packages/cli/src/bin.ts", "auth", "nonsense"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, SAMRIAN_TOKEN: "sam_test" },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unknown command");
  });

  it("documents bounded contact list and get commands", () => {
    const result = spawnSync("bun", ["packages/cli/src/bin.ts", "contacts", "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("get");
    expect(result.stdout).toContain("import");
  });

  it("exposes registered capability command groups", () => {
    const result = spawnSync("bun", ["packages/cli/src/bin.ts", "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.stdout).toContain("groups");
    expect(result.stdout).toContain("campaigns");
    expect(result.stdout).toContain("mailboxes");
    expect(result.stdout).toContain("inbox");
    expect(result.stdout).toContain("analytics");
  });

  it("requires --yes for non-interactive campaign launch", () => {
    const result = spawnSync(
      "bun",
      ["packages/cli/src/bin.ts", "campaigns", "launch", "campaign_1", "--mailbox", "mailbox_1"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, SAMRIAN_TOKEN: "sam_test" },
      }
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--yes");
  });

  it("prints PowerShell completion without requiring credentials", () => {
    const result = spawnSync("bun", ["packages/cli/src/bin.ts", "completion", "powershell"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Register-ArgumentCompleter");
    expect(result.stdout).toContain("campaigns");
    expect(result.stderr).toBe("");
  });
});
