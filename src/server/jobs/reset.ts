import type { JobRepos } from "./types";

export async function resetCounters(deps: { repos: Pick<JobRepos, "mailboxes"> }) {
  const count = await deps.repos.mailboxes.resetDailyCounters();
  return { status: "reset" as const, count };
}
