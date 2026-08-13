export type JobProvider = "inngest" | "bullmq";

export type QueueEnv = Partial<Record<string, string | undefined>>;

export type QueueConfig =
  | {
      provider: "inngest";
      concurrency: number;
      defaultAttempts: number;
    }
  | {
      provider: "bullmq";
      redisUrl: string;
      concurrency: number;
      defaultAttempts: number;
      prefix?: string;
    };

export function readQueueConfig(env: QueueEnv = process.env): QueueConfig {
  const provider = readProvider(env.JOB_PROVIDER);
  const concurrency = readPositiveInt(env.WORKER_CONCURRENCY, 5, "WORKER_CONCURRENCY");
  const defaultAttempts = readPositiveInt(env.JOB_DEFAULT_ATTEMPTS, 3, "JOB_DEFAULT_ATTEMPTS");

  if (provider === "inngest") {
    return { provider, concurrency, defaultAttempts };
  }

  const redisUrl = env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required when JOB_PROVIDER=bullmq");

  return {
    provider,
    redisUrl,
    concurrency,
    defaultAttempts,
    prefix: env.BULLMQ_PREFIX,
  };
}

function readProvider(value: string | undefined): JobProvider {
  if (!value) return "inngest";
  if (value === "inngest" || value === "bullmq") return value;
  throw new Error("JOB_PROVIDER must be one of: inngest, bullmq");
}

function readPositiveInt(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}
