import { Server } from "socket.io";
import { ApiKey } from "./models.js";
import { hashKey } from "./middleware.js";
import { makeRedis } from "./redis.js";

// Bidirectional: server pushes node-level trace events; client can subscribe to one execution.
export function attachSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  io.use(async (socket, next) => {
    const rec = await ApiKey.findOne({
      keyHash: hashKey(socket.handshake.auth?.apiKey || ""),
      revoked: false,
    });
    if (!rec) return next(new Error("unauthorized"));
    socket.data.tenantId = String(rec.tenantId);
    next();
  });
  io.on("connection", (socket) => {
    socket.join(`tenant:${socket.data.tenantId}`);
    socket.on("watch", (executionId) => socket.join(`exec:${executionId}`)); 
  });
  const sub = makeRedis();
  sub.subscribe("exec-events");
  sub.on("message", (_c, msg) => {
    const { room, ...ev } = JSON.parse(msg);
    io.to(room).emit("trace", ev); // tenant-scoped: other tenants never see this
  });
  return io;
}
