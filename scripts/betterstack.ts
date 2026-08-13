import { MONITOR_SPECS, STATUS_COMPONENTS } from "../src/server/observability/alerts";

export type BetterStackSetupResult = {
  ok: boolean;
  applied: boolean;
  failures: string[];
};

type BetterStackSetupDeps = {
  args: string[];
  env: Record<string, string | undefined>;
  fetch?: typeof fetch;
  write?: (line: string) => void;
  baseUrl?: string;
};

const API_BASE = "https://uptime.betterstack.com/api/v2";

export async function runBetterStackSetup(
  deps: BetterStackSetupDeps
): Promise<BetterStackSetupResult> {
  const args = new Set(deps.args);
  const apply = args.has("--apply");
  const syncStatusPage = args.has("--status-page");
  const write = deps.write ?? console.log;
  const failures: string[] = [];

  if (apply && !deps.env.BETTER_STACK_UPTIME_TOKEN) {
    failures.push("missing env: BETTER_STACK_UPTIME_TOKEN");
  }
  if (apply && syncStatusPage && !deps.env.BETTER_STACK_STATUS_PAGE_ID) {
    failures.push("missing env: BETTER_STACK_STATUS_PAGE_ID");
  }
  if (failures.length > 0) return { ok: false, applied: false, failures };

  const baseUrl = deps.baseUrl ?? deps.env.BETTER_STACK_BASE_URL ?? deps.env.NEXT_PUBLIC_APP_URL;
  if (apply && !baseUrl) {
    return { ok: false, applied: false, failures: ["missing env: NEXT_PUBLIC_APP_URL"] };
  }

  if (!apply) {
    write(
      `Dry run: ${MONITOR_SPECS.length} monitors, ${STATUS_COMPONENTS.length} status components`
    );
    for (const monitor of MONITOR_SPECS) write(`monitor: ${monitor.name} ${monitor.path}`);
    for (const component of STATUS_COMPONENTS) write(`component: ${component.name}`);
    return { ok: true, applied: false, failures: [] };
  }

  const fetchImpl = deps.fetch ?? fetch;
  for (const monitor of MONITOR_SPECS) {
    await fetchImpl(`${API_BASE}/monitors`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.env.BETTER_STACK_UPTIME_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "monitor",
          attributes: monitorToAttributes(baseUrl!, monitor),
        },
      }),
    });
  }

  if (syncStatusPage) {
    for (const component of STATUS_COMPONENTS) {
      await fetchImpl(
        `${API_BASE}/status-pages/${deps.env.BETTER_STACK_STATUS_PAGE_ID}/resources`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${deps.env.BETTER_STACK_UPTIME_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              type: "status_page_resource",
              attributes: { name: component.name, public_name: component.name },
            },
          }),
        }
      );
    }
  }

  write(`Applied Better Stack plan: ${MONITOR_SPECS.length} monitors`);
  return { ok: true, applied: true, failures: [] };
}

function monitorToAttributes(baseUrl: string, monitor: (typeof MONITOR_SPECS)[number]) {
  return {
    monitor_type: "status",
    pronounceable_name: monitor.name,
    url: `${baseUrl.replace(/\/$/, "")}${monitor.path}`,
    http_method: monitor.method,
    required_status_code: monitor.expectedStatus,
    required_keyword: monitor.keyword,
    check_frequency: 60,
  };
}

async function main() {
  const result = await runBetterStackSetup({
    args: process.argv.slice(2),
    env: process.env,
  });

  if (!result.ok) {
    console.error(result.failures.join("\n"));
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("betterstack.ts")) {
  await main();
}
