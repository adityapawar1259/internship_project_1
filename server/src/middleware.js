import crypto from "node:crypto";
import { ApiKey, Tenant, User, RevokedToken } from "./models.js";
import { verifyToken } from "./auth.js";
import { config } from "./config.js";
export const hashKey = (k) =>
  crypto.createHash("sha256").update(k).digest("hex");
export const generateApiKey = () =>
  "wf_" + crypto.randomBytes(24).toString("hex");
export async function resolveBearer(token) {
  const p = verifyToken(token);
  if (!p) return null;
  if (await RevokedToken.exists({ jti: p.jti })) return null;
  const user = await User.findById(p.sub);
  return user ? { user, payload: p } : null;
}
export async function tenantContext(req, res, next) {
  try {
    const h = req.header("authorization") || "";
    if (h.startsWith("Bearer ")) {
      const r = await resolveBearer(h.slice(7));
      if (!r)
        return res
          .status(401)
          .json({ error: "Session expired. Please sign in again." });
      req.user = r.user;
      req.tenantId = r.user.tenantId;
      req.tenant = await Tenant.findById(r.user.tenantId);
      if (!req.tenant)
        return res.status(401).json({ error: "Workspace not found" });
      return next();
    }
    const key = req.header("x-api-key");
    if (!key) return res.status(401).json({ error: "Not signed in" });
    const rec = await ApiKey.findOne({ keyHash: hashKey(key), revoked: false });
    if (!rec) return res.status(401).json({ error: "Invalid API key" });
    req.tenantId = rec.tenantId;
    req.tenant = await Tenant.findById(rec.tenantId);
    return next();
  } catch (e) {
    next(e);
  }
}
const buckets = new Map();
export function rateLimiter(req, res, next) {
  const k = String(req.tenantId),
    now = Date.now(),
    b = buckets.get(k);
  if (!b || now - b.start >= 60000) buckets.set(k, { start: now, count: 1 });
  else if (++b.count > config.rateLimitPerMin)
    return res.status(429).json({ error: "Rate limit exceeded" });
  next();
}
export const adminOnly = (req, res, next) =>
  req.header("x-admin-secret") === config.adminSecret
    ? next()
    : res.status(403).json({ error: "Forbidden" });
