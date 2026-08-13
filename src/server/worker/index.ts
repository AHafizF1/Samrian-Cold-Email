export { createWorkerDeps } from "./deps";
export {
  createBullMqWorkerProcessors,
  createBullMqWorkers,
  type BullMqWorkerRuntime,
  type WorkerDeps,
  type WorkerProcessorMap,
} from "./worker";

import { readQueueConfig } from "../queue";
import type { JobQueue } from "../ports";
import { createWorkerDeps } from "./deps";
import { createBullMqWorkers } from "./worker";

export function startWorker(queue?: JobQueue) {
  const config = readQueueConfig();
  if (config.provider !== "bullmq") {
    throw new Error("Worker process requires JOB_PROVIDER=bullmq");
  }

  return createBullMqWorkers(config, createWorkerDeps(queue));
}

export async function scheduleWorkerJobs(queue: JobQueue) {
  await Promise.all([
    queue.scheduleCampaignDispatch({ cron: "*/5 * * * *", timezone: "UTC" }),
    queue.scheduleMailboxChecks({ cron: "0 * * * *", timezone: "UTC" }),
    queue.scheduleMailboxRamp({ cron: "15 0 * * *", timezone: "UTC" }),
    queue.scheduleDailyCounterReset({ cron: "0 0 * * *", timezone: "UTC" }),
  ]);
}
