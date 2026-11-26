import { Execution, Workflow, DeadLetter } from "./models.js";
import { runSaga } from "./engine/saga.js";
import { runners, compensate } from "./engine/runners.js";
import { emitTenant } from "./sockets.js";
let busy = false;
async function processOne() {
  if (busy) return;
  busy = true;
  let claimed = null;
  try {
    const exec = await Execution.findOneAndUpdate(
      { status: "PENDING" },
      { $set: { status: "RUNNING", startedAt: new Date(), steps: [] } },
      { new: true, sort: { createdAt: 1 } },
    );
    if (!exec) return;
    claimed = exec;
    const wf = await Workflow.findOne({
      _id: exec.workflowId,
      tenantId: exec.tenantId,
    });
    if (!wf) throw new Error("Workflow no longer exists");
    const result = await runSaga({
      graph: wf.graph,
      input: exec.input || {},
      runners,
      compensate,
      executionId: String(exec._id),
      onEvent: (ev) => {
        emitTenant(exec.tenantId, { executionId: String(exec._id), ...ev });
        if (
          ev.type === "node" &&
          [
            "COMPLETED",
            "FAILED",
            "SKIPPED",
            "COMPENSATED",
            "COMPENSATION_FAILED",
          ].includes(ev.state)
        ) {
          const { nodeId, state, attempts, durationMs, error, output } = ev;
          exec.steps.push({
            nodeId,
            state,
            attempts,
            durationMs,
            error,
            output,
          });
        }
      },
    });
    exec.status = result.status;
    exec.error = result.error;
    exec.finishedAt = new Date();
    await exec.save();
    if (result.status === "ROLLED_BACK")
      await DeadLetter.create({
        tenantId: exec.tenantId,
        executionId: exec._id,
        reason: result.error || "Workflow rolled back",
      });
    emitTenant(exec.tenantId, {
      executionId: String(exec._id),
      type: "execution",
      state: exec.status,
      error: exec.error,
    });
    claimed = null; // terminal state was persisted successfully
  } catch (e) {
    console.error("Local worker error:", e);
    if (claimed) {
      try {
        claimed.status = "FAILED";
        claimed.error = e.message;
        claimed.finishedAt = new Date();
        await claimed.save();
        await DeadLetter.create({
          tenantId: claimed.tenantId,
          executionId: claimed._id,
          reason: e.message,
        });
        emitTenant(claimed.tenantId, {
          executionId: String(claimed._id),
          type: "execution",
          state: "FAILED",
          error: e.message,
        });
      } catch (saveError) {
        console.error("Could not persist worker failure:", saveError.message);
      }
    }
  } finally {
    busy = false;
  }
}
export function startWorker() {
  const timer = setInterval(processOne, 500);
  timer.unref();
  processOne();
  console.log("MongoDB local worker started (no Redis required)");
  return () => clearInterval(timer);
}
