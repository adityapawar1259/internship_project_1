import { Schema, model, type InferSchemaType } from 'mongoose';

const NodeSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true, enum: ['start', 'http', 'condition', 'task', 'end'] },
  config: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const EdgeSchema = new Schema({
  source: { type: String, required: true },
  target: { type: String, required: true }
}, { _id: false });

const WorkflowSchema = new Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  nodes: { type: [NodeSchema], default: [] },
  edges: { type: [EdgeSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

WorkflowSchema.index({ tenantId: 1, createdAt: -1 });
WorkflowSchema.index({ tenantId: 1, name: 1 });

export type WorkflowDocument = InferSchemaType<typeof WorkflowSchema>;
export const Workflow = model('Workflow', WorkflowSchema);
