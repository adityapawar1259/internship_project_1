import mongoose from "mongoose";
const { Schema } = mongoose;

// Multi-tenancy strategy: DISCRIMINATOR KEY (tenantId on every doc + compound indexes).
const tenantField = {
  type: Schema.Types.ObjectId,
  ref: "Tenant",
  required: true,
  index: true,
};

export const Tenant = mongoose.model(
  "Tenant",
  new Schema(
    {
      name: { type: String, required: true },
      monthlyQuota: { type: Number, default: 10000 },
      usedThisMonth: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);

export const ApiKey = mongoose.model(
  "ApiKey",
  new Schema(
    {
      tenantId: tenantField,
      keyHash: { type: String, unique: true, required: true }, // only the SHA-256 hash is stored
      prefix: String,
      revoked: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
);

export const Workflow = mongoose.model(
  "Workflow",
  new Schema(
    {
      tenantId: tenantField,
      name: String,
      graph: { nodes: [Schema.Types.Mixed], edges: [Schema.Types.Mixed] },
      trigger: { event: String }, // fires when an Event with this type is inserted
      active: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

const executionSchema = new Schema(
  {
    tenantId: tenantField,
    workflowId: { type: Schema.Types.ObjectId, ref: "Workflow", index: true },
    status: { type: String, default: "PENDING", index: true },
    input: Schema.Types.Mixed,
    steps: [
      {
        nodeId: String,
        state: String,
        attempts: Number,
        durationMs: Number,
        error: String,
        output: Schema.Types.Mixed,
      },
    ],
    error: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true },
);
executionSchema.index({ tenantId: 1, createdAt: -1 });
export const Execution = mongoose.model("Execution", executionSchema);

export const Event = mongoose.model(
  "Event",
  new Schema(
    {
      tenantId: tenantField,
      type: String,
      payload: Schema.Types.Mixed,
    },
    { timestamps: true },
  ),
);

export const DeadLetter = mongoose.model(
  "DeadLetter",
  new Schema(
    {
      tenantId: tenantField,
      executionId: Schema.Types.ObjectId,
      reason: String,
    },
    { timestamps: true },
  ),
);
