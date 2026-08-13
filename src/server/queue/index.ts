import { BullMqQueue } from "./bullmq";
import { readQueueConfig, type QueueEnv } from "./config";

export { BullMqQueue, type BullMqQueueConfig } from "./bullmq";
export { readQueueConfig, type JobProvider, type QueueConfig, type QueueEnv } from "./config";
export { JOB_NAMES, type JobName } from "./names";

export function createJobQueue(env?: QueueEnv) {
  const config = readQueueConfig(env);

  if (config.provider === "bullmq") {
    return new BullMqQueue({
      redisUrl: config.redisUrl,
      defaultAttempts: config.defaultAttempts,
      prefix: config.prefix,
    });
  }

  throw new Error("Inngest JobQueue requires an Inngest step; use createInngestQueue instead");
}
