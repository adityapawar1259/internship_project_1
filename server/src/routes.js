import { Router } from "express";
import {
  Tenant,
  ApiKey,
  Workflow,
  Execution,
  Event,
  DeadLetter,
} from "./models.js";
import {
  tenantContext,
  rateLimiter,
  adminOnly,
  generateApiKey,
  hashKey,
} from "./middleware.js";
import { validateGraph } from "./engine/dag.js";
import { enqueueExecution } from "./queue.js";

export const router = Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// --- Admin bootstrap: create tenant + one-time API key
router.post(
  "/tenants",
  adminOnly,
  wrap(async (req, res) => {
    const tenant = await Tenant.create({
      name: req.body.name,
      monthlyQuota: req.body.monthlyQuota,
    });
    const key = generateApiKey();
    await ApiKey.create({
      tenantId: tenant._id,
      keyHash: hashKey(key),
      prefix: key.slice(0, 7),
    });
    res.status(201).json({
      tenantId: tenant._id,
      apiKey: key,
      note: "Store this key now; it cannot be shown again.",
    });
  }),
);

// Everything below is tenant-scoped.
router.use(tenantContext, rateLimiter);

router.post("/workflows/validate", (req, res) =>
  res.json(validateGraph(req.body.graph)),
);

router.post(
  "/workflows",
  wrap(async (req, res) => {
    const v = validateGraph(req.body.graph);
    if (!v.valid) return res.status(400).json(v);
    const wf = await Workflow.create({
      tenantId: req.tenantId,
      name: req.body.name,
      graph: req.body.graph,
      trigger: req.body.trigger,
    });
    res.status(201).json(wf);
  }),
);
router.get(
  "/workflows",
  wrap(async (req, res) =>
    res.json(
      await Workflow.find({ tenantId: req.tenantId }).sort("-createdAt"),
    ),
  ),
);

async function startRun(tenant, workflowId, input) {
  if (tenant.usedThisMonth >= tenant.monthlyQuota) return null;
  const exec = await Execution.create({
    tenantId: tenant._id,
    workflowId,
    input,
  });
  await Tenant.updateOne({ _id: tenant._id }, { $inc: { usedThisMonth: 1 } });
  await enqueueExecution(exec._id);
  return exec;
}
router.post(
  "/workflows/:id/run",
  wrap(async (req, res) => {
    const wf = await Workflow.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!wf) return res.status(404).json({ error: "Workflow not found" });
    const exec = await startRun(req.tenant, wf._id, req.body.input);
    if (!exec) return res.status(402).json({ error: "Monthly quota exceeded" });
    res.status(202).json(exec);
  }),
);

router.get(
  "/executions",
  wrap(async (req, res) =>
    res.json(
      await Execution.find({ tenantId: req.tenantId })
        .sort("-createdAt")
        .limit(100),
    ),
  ),
);
router.get(
  "/executions/:id",
  wrap(async (req, res) =>
    res.json(
      await Execution.findOne({ _id: req.params.id, tenantId: req.tenantId }),
    ),
  ),
);

// Event ingestion: the Change Stream picks this insert up and triggers matching workflows.
router.post(
  "/events",
  wrap(async (req, res) => {
    const ev = await Event.create({
      tenantId: req.tenantId,
      type: req.body.type,
      payload: req.body.payload,
    });
    res.status(202).json({ id: ev._id });
  }),
);

// Dead-letter queue
router.get(
  "/dlq",
  wrap(async (req, res) =>
    res.json(
      await DeadLetter.find({ tenantId: req.tenantId })
        .sort("-createdAt")
        .limit(100),
    ),
  ),
);
router.post(
  "/dlq/:id/retry",
  wrap(async (req, res) => {
    const dl = await DeadLetter.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!dl) return res.status(404).json({ error: "Not found" });
    const old = await Execution.findById(dl.executionId);
    const exec = await startRun(req.tenant, old.workflowId, old.input);
    await dl.deleteOne();
    res.status(202).json(exec);
  }),
);

// Dashboard metrics: quota, latency percentiles per hour, failure heatmap (workflow x hour)
router.get(
  "/metrics",
  wrap(async (req, res) => {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const base = {
      tenantId: req.tenantId,
      createdAt: { $gte: since },
      finishedAt: { $exists: true },
    };
    const lat = await Execution.aggregate([
      { $match: base },
      {
        $project: {
          hour: { $hour: "$finishedAt" },
          ms: { $subtract: ["$finishedAt", "$startedAt"] },
        },
      },
      {
        $group: {
          _id: "$hour",
          avg: { $avg: "$ms" },
          max: { $max: "$ms" },
          count: { $sum: 1 },
          all: { $push: "$ms" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const latency = lat.map((h) => {
      const s = h.all.sort((a, b) => a - b);
      return {
        hour: h._id,
        avg: Math.round(h.avg),
        p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
        count: h.count,
      };
    });
    const heatmap = await Execution.aggregate([
      { $match: { ...base, status: { $in: ["ROLLED_BACK", "FAILED"] } } },
      {
        $group: {
          _id: { workflowId: "$workflowId", hour: { $hour: "$finishedAt" } },
          failures: { $sum: 1 },
        },
      },
    ]);
    const t = req.tenant;
    res.json({
      quota: { used: t.usedThisMonth, limit: t.monthlyQuota },
      latency,
      heatmap,
    });
  }),
);
