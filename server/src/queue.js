import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const executionQueue = new Queue("executions", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3, // job-level retries for infrastructure crashes
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: false,
  },
});
export const dlq = new Queue("dead-letter", { connection: redis });
export const enqueueExecution = (executionId) =>
  executionQueue.add("run", { executionId }, { jobId: String(executionId) });
