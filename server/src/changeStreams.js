import { Event, Workflow, Execution, Tenant } from "./models.js";
import { enqueueExecution } from "./queue.js";

// Reactively starts workflows when matching Events are inserted (requires a replica set).
export function watchEvents() {
  const stream = Event.watch([{ $match: { operationType: "insert" } }]);
  stream.on("change", async ({ fullDocument: ev }) => {
    const wfs = await Workflow.find({
      tenantId: ev.tenantId,
      "trigger.event": ev.type,
      active: true,
    });
    for (const wf of wfs) {
      const exec = await Execution.create({
        tenantId: ev.tenantId,
        workflowId: wf._id,
        input: ev.payload,
      });
      await Tenant.updateOne(
        { _id: ev.tenantId },
        { $inc: { usedThisMonth: 1 } },
      );
      await enqueueExecution(exec._id);
    }
  });
  stream.on("error", (e) => console.error("change stream error", e.message));
}
