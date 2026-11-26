// MongoDB-backed local queue. The API process polls PENDING executions.
import { Execution } from "./models.js";
export const enqueueExecution = async (executionId) =>
  Execution.updateOne({ _id: executionId }, { $set: { status: "PENDING" } });
