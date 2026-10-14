import http from "node:http";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { router } from "./routes.js";
import { attachSockets } from "./sockets.js";
import { watchEvents } from "./changeStreams.js";

await connectDb();
const app = express();
app.use(cors(), express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", router);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

const server = http.createServer(app);
attachSockets(server);
watchEvents();
server.listen(config.port, () => console.log(`API on :${config.port}`));
