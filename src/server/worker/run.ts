import { createJobQueue } from "../queue";
import { scheduleWorkerJobs, startWorker } from ".";
import { closeLimitGuard } from "../limits";

const queue = createJobQueue();
await scheduleWorkerJobs(queue);
const worker = startWorker(queue);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await Promise.all([worker.close(), queue.close(), closeLimitGuard()]);
    process.exit(0);
  });
}

console.log("[OK] BullMQ worker started");
