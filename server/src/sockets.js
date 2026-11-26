import { Server } from "socket.io";
import { config } from "./config.js";
import { resolveBearer, hashKey } from "./middleware.js";
import { ApiKey } from "./models.js";
let ioInstance;
export function attachSockets(server) {
  const io = new Server(server, { cors: { origin: config.corsOrigin } });
  ioInstance = io;
  io.use(async (socket, next) => {
    try {
      const { token, apiKey } = socket.handshake.auth || {};
      if (token) {
        const r = await resolveBearer(token);
        if (!r) return next(new Error("unauthorized"));
        socket.data.tenantId = String(r.user.tenantId);
        return next();
      }
      const rec = await ApiKey.findOne({
        keyHash: hashKey(apiKey || ""),
        revoked: false,
      });
      if (!rec) return next(new Error("unauthorized"));
      socket.data.tenantId = String(rec.tenantId);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", (socket) =>
    socket.join(`tenant:${socket.data.tenantId}`),
  );
  return io;
}
export function emitTenant(tenantId, event) {
  ioInstance?.to(`tenant:${tenantId}`).emit("trace", event);
}
