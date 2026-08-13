import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getConfigPath, readConfig, writeConfig } from "../../../packages/cli/src/config";
import { describe, expect, it } from "vitest";

describe("CLI config", () => {
  it("uses platform config directory without storing token", async () => {
    const root = await mkdtemp(join(tmpdir(), "samrian-cli-"));
    const path = getConfigPath({ platform: "win32", env: { APPDATA: root }, home: root });

    await writeConfig(path, { url: "https://samrian.test" });

    await expect(readConfig(path)).resolves.toEqual({ url: "https://samrian.test" });
    expect(await readFile(path, "utf8")).not.toContain("token");
  });

  it("returns empty config when file does not exist", async () => {
    await expect(readConfig(join(tmpdir(), crypto.randomUUID(), "config.json"))).resolves.toEqual(
      {}
    );
  });
});
