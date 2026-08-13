export type SmokeResult = {
  ok: boolean;
  failures: string[];
};

type SmokeDeps = {
  baseUrl: string;
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
  allowDegraded?: boolean;
};

const REQUIRED_ENV = [
  "CREDENTIAL_ACTIVE_KEY_ID",
  "CREDENTIAL_KEYS_JSON",
  "UNSUBSCRIBE_SECRET",
  "APP_DATABASE_URL",
] as const;

export async function runSmoke(deps: SmokeDeps): Promise<SmokeResult> {
  const failures: string[] = [];
  const fetchImpl = deps.fetch ?? fetch;

  for (const name of REQUIRED_ENV) {
    if (!deps.env?.[name]) failures.push(`missing env: ${name}`);
  }
  if ((deps.env?.AUTH_PROVIDER ?? "better-auth") === "better-auth") {
    for (const name of ["BETTER_AUTH_SECRET", "AUTH_DATABASE_URL"] as const) {
      if (!deps.env?.[name]) failures.push(`missing env: ${name}`);
    }
  }

  try {
    const response = await fetchImpl(`${deps.baseUrl.replace(/\/$/, "")}/api/health`);
    const health = (await response.json()) as { status?: string };
    if (!response.ok && health.status !== "degraded") failures.push("health endpoint unhealthy");
    if (health.status === "degraded" && !deps.allowDegraded)
      failures.push("health endpoint degraded");
  } catch {
    failures.push("health endpoint unavailable");
  }

  try {
    const response = await fetchImpl(`${deps.baseUrl.replace(/\/$/, "")}/api/auth/get-session`);
    if (response.status >= 500) failures.push("auth route unavailable");
  } catch {
    failures.push("auth route unavailable");
  }

  return { ok: failures.length === 0, failures };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
  const result = await runSmoke({
    baseUrl,
    env: process.env,
    allowDegraded: args.has("--allow-degraded"),
  });

  if (!result.ok) {
    console.error(result.failures.join("\n"));
    process.exit(1);
  }

  console.log("[OK] Smoke passed");
}

if (process.argv[1]?.endsWith("smoke.ts")) {
  await main();
}
