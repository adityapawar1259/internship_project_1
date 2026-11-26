import http from "node:http";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { connectDb, dbName, dbState } from "./db.js";
import { router } from "./routes.js";
import { authRouter } from "./authRoutes.js";
import { attachSockets } from "./sockets.js";
import { startWorker } from "./worker.js";
import { Workflow, Event, Execution } from "./models.js";
import { consumeQuota } from "./quota.js";

await connectDb();
if (config.jwtSecret === "dev-jwt-secret-change-me")
  console.warn(
    "WARNING: JWT_SECRET is the default value. Set your own long random JWT_SECRET before deploying.",
  );
const app = express();
app.use(cors({ origin: config.corsOrigin }), express.json({ limit: "1mb" }));
app.set("trust proxy", 1); // correct client IP behind a load balancer (login throttling)
app.get("/health", (_req, res) => {
  const ok = dbState() === "connected";
  res.status(ok ? 200 : 503).json({ ok, db: dbName(), state: dbState() });
});
if (process.env.ENABLE_DEBUG_ROUTES === "true")
  // local demos only: returns any HTTP status you ask for
  app.all("/debug/status/:code", (req, res) =>
    res.status(Number(req.params.code) || 500).json({ code: req.params.code }),
  );
app.use("/api/auth", authRouter);
app.use("/api", router);
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Request body is not valid JSON" });
  if (err.name === "CastError")
    return res.status(400).json({ error: `Invalid ${err.path}` });
  if (err.name === "ValidationError")
    return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

const server = http.createServer(app);
attachSockets(server);
startWorker();
// Poll event documents instead of MongoDB Change Streams, so standalone local MongoDB works.
let eventPollBusy = false;
const latestEventAtBoot = await Event.findOne().sort({ _id: -1 }).select("_id");
let lastEventId = latestEventAtBoot?._id || null;
setInterval(async () => {
  if (eventPollBusy) return;
  eventPollBusy = true;
  try {
    const query = lastEventId ? { _id: { $gt: lastEventId } } : {};
    const events = await Event.find(query).sort({ _id: 1 }).limit(100);
    for (const ev of events) {
      lastEventId = ev._id;
      const wfs = await Workflow.find({
        tenantId: ev.tenantId,
        "trigger.event": ev.type,
        active: true,
      });
      for (const wf of wfs) {
        if (!(await consumeQuota(ev.tenantId))) continue;
        await Execution.create({
          tenantId: ev.tenantId,
          workflowId: wf._id,
          input: ev.payload,
          status: "PENDING",
        });
      }
    }
  } catch (e) {
    console.error("Event trigger poll:", e.message);
  } finally {
    eventPollBusy = false;
  }
}, 1000).unref();
server.listen(config.port, () => console.log(`API on :${config.port}`));
