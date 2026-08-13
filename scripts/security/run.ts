import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const SECURITY_MODES = ["semgrep", "gitleaks", "trivy", "schemathesis", "audit"] as const;

export type SecurityMode = (typeof SECURITY_MODES)[number];

const IMAGES = {
  semgrep: "semgrep/semgrep:1.136.0",
  gitleaks: "zricethezav/gitleaks:v8.24.3",
  trivy: "aquasec/trivy:0.66.0",
  schemathesis: "schemathesis/schemathesis:v4.1.1",
} as const;

type Env = Record<string, string | undefined>;
type Spawn = (command: string[]) => Promise<number>;

export type ScanPlan = {
  mode: Exclude<SecurityMode, "audit">;
  tool: keyof typeof IMAGES;
  image: string;
  command: string[];
  reportDir: string;
  runId: string;
  target?: string;
};

type PlanInput = {
  mode: string;
  root: string;
  runId: string;
  env: Env;
};

type RunInput = {
  mode: string;
  root?: string;
  env?: Env;
  dryRun?: boolean;
  spawn?: Spawn;
  uuid?: () => string;
};

export function createRunId(uuid: () => string = randomUUID): string {
  return `sec_${uuid()}`;
}

export function getScanPlan(input: PlanInput): ScanPlan {
  const mode = parseLeafMode(input.mode);
  const reportDir = safeReportDir(input.root, input.runId, mode);
  const target = input.env.SECURITY_BASE_URL?.replace(/\/$/, "");

  if (mode === "schemathesis") requireEnv(input.env, ["SECURITY_BASE_URL", "SAMRIAN_TOKEN"]);
  if (mode === "schemathesis" && !isDisposableTarget(target, input.env)) {
    throw new Error("Mutation-capable security scans cannot target production");
  }

  const workspace = dockerPath(input.root);
  const report = `/workspace/security/reports/${input.runId}/${mode}`;
  const common = ["docker", "run", "--rm", "-v", `${workspace}:/workspace:rw`];

  if (mode === "semgrep") {
    return leafPlan(mode, "semgrep", reportDir, input.runId, [
      ...common,
      IMAGES.semgrep,
      "semgrep",
      "scan",
      "--error",
      "--config",
      "p/owasp-top-ten",
      "--config",
      "p/typescript",
      "--config",
      "p/secrets",
      "--config",
      "/workspace/security/semgrep/config.yaml",
      "--json-output",
      `${report}/semgrep.json`,
      "/workspace",
    ]);
  }

  if (mode === "gitleaks") {
    return leafPlan(mode, "gitleaks", reportDir, input.runId, [
      ...common,
      IMAGES.gitleaks,
      "detect",
      "--source",
      "/workspace",
      "--report-format",
      "json",
      "--report-path",
      `${report}/gitleaks.json`,
      "--redact",
    ]);
  }

  if (mode === "trivy") {
    return leafPlan(mode, "trivy", reportDir, input.runId, [
      ...common,
      "-v",
      "samrian-trivy-cache:/root/.cache",
      IMAGES.trivy,
      "fs",
      "--scanners",
      "vuln,secret,misconfig,license",
      "--format",
      "json",
      "--output",
      `${report}/trivy.json`,
      "--skip-dirs",
      "/workspace/node_modules",
      "--skip-dirs",
      "/workspace/.next",
      "--skip-dirs",
      "/workspace/security/reports",
      "--skip-dirs",
      "/workspace/.git",
      "--skip-dirs",
      "/workspace/dist",
      "--skip-dirs",
      "/workspace/coverage",
      "--exit-code",
      "1",
      "/workspace",
    ]);
  }

  return {
    ...leafPlan(mode, "schemathesis", reportDir, input.runId, [
      ...common,
      "-e",
      "SECURITY_BASE_URL",
      "-e",
      `SECURITY_RUN_ID=${input.runId}`,
      "-e",
      "SAMRIAN_TOKEN",
      "-e",
      "SCHEMATHESIS_HOOKS=security.schemathesis",
      IMAGES.schemathesis,
      "run",
      `${target}/api/v1/openapi.json`,
      "--checks",
      "not_a_server_error,status_code_conformance,response_schema_conformance",
      "--max-examples",
      "20",
    ]),
    target,
  };
}

export async function runSecurity(input: RunInput) {
  const mode = parseMode(input.mode);
  const root = path.resolve(input.root ?? process.cwd());
  const env = input.env ?? process.env;
  const runId = createRunId(input.uuid);
  const modes = mode === "audit" ? safeAuditModes() : [mode];
  const plans = modes.map((item) => getScanPlan({ mode: item, root, runId, env }));

  if (input.dryRun) return { status: "dry-run" as const, runId, plans };

  const spawn = input.spawn ?? spawnCommand;
  const results = [];
  for (const plan of plans) {
    await mkdir(plan.reportDir, { recursive: true });
    const exitCode = await spawn(plan.command);
    const status = classifyExit(plan.mode, exitCode);
    await writeManifest(plan, env, status, exitCode);
    if (status === "failed")
      throw new Error(`${plan.tool} scanner failed with exit code ${exitCode}`);
    if (plan.mode === "gitleaks" && status === "findings") {
      throw new Error("Gitleaks found potential secrets");
    }
    results.push({ mode: plan.mode, status, exitCode });
  }

  return results.length === 1 ? results[0] : { status: "complete" as const, runId, results };
}

function safeAuditModes(): Exclude<SecurityMode, "audit">[] {
  return ["semgrep", "gitleaks", "trivy", "schemathesis"];
}

function classifyExit(mode: Exclude<SecurityMode, "audit">, exitCode: number) {
  if (exitCode === 0) return "passed" as const;
  if (mode === "gitleaks" && exitCode === 1) return "findings" as const;
  if ((mode === "trivy" || mode === "semgrep") && exitCode === 1) {
    return "findings" as const;
  }
  return "failed" as const;
}

async function writeManifest(
  plan: ScanPlan,
  env: Env,
  status: "passed" | "findings" | "failed",
  exitCode: number
) {
  const git = getGitState();
  const manifest = {
    runId: plan.runId,
    time: new Date().toISOString(),
    environment: env.SECURITY_ENVIRONMENT ?? "local-security",
    authProvider: env.SECURITY_AUTH_PROVIDER ?? env.AUTH_PROVIDER ?? "better-auth",
    queueProvider: env.JOB_PROVIDER ?? "disabled",
    storageProvider: env.STORAGE_PROVIDER ?? "disabled",
    tool: plan.tool,
    image: plan.image,
    mode: plan.mode,
    target: plan.target ? new URL(plan.target).origin : undefined,
    status,
    exitCode,
    git,
    reports: reportNames(plan.mode),
  };
  await writeFile(
    path.join(plan.reportDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

function getGitState() {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
    return { commit, dirty: status.trim().length > 0 };
  } catch {
    return { commit: "unknown", dirty: true };
  }
}

function reportNames(mode: Exclude<SecurityMode, "audit">) {
  if (mode === "semgrep") return ["semgrep.json"];
  if (mode === "gitleaks") return ["gitleaks.json"];
  if (mode === "trivy") return ["trivy.json"];
  return [];
}

function safeReportDir(root: string, runId: string, mode: string) {
  if (!/^sec_[A-Za-z0-9-]+$/.test(runId)) throw new Error("Invalid security run ID");
  const reportsRoot = path.resolve(root, "security", "reports");
  const result = path.resolve(reportsRoot, runId, mode);
  if (!result.startsWith(`${reportsRoot}${path.sep}`)) throw new Error("Invalid report path");
  return result;
}

function dockerPath(value: string) {
  return path.resolve(value).replaceAll("\\", "/");
}

function isProductionTarget(target?: string) {
  if (!target) return false;
  const host = new URL(target).hostname;
  return !["localhost", "127.0.0.1", "host.docker.internal"].includes(host);
}

function isDisposableTarget(target: string | undefined, env: Env) {
  if (env.SECURITY_ENVIRONMENT === "production") return false;
  if (!isProductionTarget(target)) return true;
  return (
    env.SECURITY_ENVIRONMENT === "disposable-staging" &&
    env.SECURITY_DISPOSABLE === "I_UNDERSTAND_THIS_DATA_IS_DISPOSABLE"
  );
}

function requireEnv(env: Env, names: string[]) {
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length)
    throw new Error(`Missing security environment variables: ${missing.join(", ")}`);
}

function parseMode(mode: string): SecurityMode {
  if (!SECURITY_MODES.includes(mode as SecurityMode)) {
    throw new Error(`Unknown security scan mode: ${mode}`);
  }
  return mode as SecurityMode;
}

function parseLeafMode(mode: string): Exclude<SecurityMode, "audit"> {
  const parsed = parseMode(mode);
  if (parsed === "audit") throw new Error("Audit mode must be expanded before planning");
  return parsed;
}

function leafPlan<M extends Exclude<SecurityMode, "audit">, T extends keyof typeof IMAGES>(
  mode: M,
  tool: T,
  reportDir: string,
  runId: string,
  command: string[]
): ScanPlan {
  return { mode, tool, image: IMAGES[tool], reportDir, runId, command };
}

async function spawnCommand(command: string[]) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command[0]!, command.slice(1), {
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find((arg) => !arg.startsWith("--")) ?? "";
  const dryRun = args.includes("--dry-run");
  const result = await runSecurity({ mode, dryRun });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1]?.endsWith(path.join("scripts", "security", "run.ts"))) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Security runner failed";
    process.stderr.write(`[X] ${message}\n`);
    process.exit(1);
  });
}
