import { Worker } from "bullmq";
import { connectDb } from "./db.js";
import { Execution, Workflow, DeadLetter } from "./models.js";
import { redis, makeRedis } from "./redis.js";
import { dlq } from "./queue.js";
import { runSaga } from "./engine/saga.js";
import { runners, compensate } from "./engine/runners.js";
import { config } from "./config.js";

await connectDb();
const pub = makeRedis();

async function handleJob(job) {
  const exec = await Execution.findById(job.data.executionId);
  const wf = await Workflow.findOne({
    _id: exec.workflowId,
    tenantId: exec.tenantId,
  });
  const room = `tenant:${exec.tenantId}`;
  const emit = (ev) =>
    pub.publish(
      "exec-events",
      JSON.stringify({ room, executionId: String(exec._id), ...ev }),
    );

  exec.status = "RUNNING";
  exec.startedAt = new Date();
  await exec.save();
  const result = await runSaga({
    graph: wf.graph,
    input: exec.input || {},
    runners,
    compensate,
    onEvent: (ev) => {
      emit(ev);
      if (
        ev.type === "node" &&
        ["COMPLETED", "FAILED", "SKIPPED", "COMPENSATED"].includes(ev.state)
      ) {
        const { nodeId, state, attempts, durationMs, error, output } = ev;
        exec.steps.push({ nodeId, state, attempts, durationMs, error, output });
      }
    },
  });
  exec.status = result.status;
  exec.error = result.error;
  exec.finishedAt = new Date();
  await exec.save();
  if (result.status === "ROLLED_BACK") {
    // Permanently failed workflow -> dead-letter queue so an operator can inspect/replay it.
    await DeadLetter.create({
      tenantId: exec.tenantId,
      executionId: exec._id,
      reason: result.error,
    });
    await dlq.add("failed-execution", {
      executionId: String(exec._id),
      reason: result.error,
    });
  }
}

const worker = new Worker("executions", handleJob, {
  connection: redis,
  concurrency: config.workerConcurrency,
});
worker.on("failed", async (job, err) => {
  // Infra-level failure after all BullMQ attempts (e.g. worker crash, DB down) -> DLQ.
  if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
    const exec = await Execution.findById(job.data.executionId);
    if (exec) {
      exec.status = "FAILED";
      exec.error = err.message;
      await exec.save();
      await DeadLetter.create({
        tenantId: exec.tenantId,
        executionId: exec._id,
        reason: err.message,
      });
    }
    await dlq.add("infra-failure", {
      executionId: job.data.executionId,
      reason: err.message,
    });
  }
});
console.log(`Worker up (concurrency ${config.workerConcurrency})`);
