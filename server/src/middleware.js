import crypto from "node:crypto";
import { ApiKey, Tenant } from "./models.js";
import { redis } from "./redis.js";
import { config } from "./config.js";

export const hashKey = (k) =>
  crypto.createHash("sha256").update(k).digest("hex");
export const generateApiKey = () =>
  "wf_" + crypto.randomBytes(24).toString("hex");

// Resolves tenant from the x-api-key header and attaches it to the request.
export async function tenantContext(req, res, next) {
  try {
    const key = req.header("x-api-key");
    if (!key) return res.status(401).json({ error: "Missing x-api-key" });
    const rec = await ApiKey.findOne({ keyHash: hashKey(key), revoked: false });
    if (!rec) return res.status(401).json({ error: "Invalid API key" });
    req.tenantId = rec.tenantId;
    req.tenant = await Tenant.findById(rec.tenantId);
    next();
  } catch (e) {
    next(e);
  }
}

// Fixed-window per-tenant rate limit backed by Redis (works across API instances).
export async function rateLimiter(req, res, next) {
  try {
    const bucket = `rl:${req.tenantId}:${Math.floor(Date.now() / 60000)}`;
    const n = await redis.incr(bucket);
    if (n === 1) await redis.expire(bucket, 70);
    if (n > config.rateLimitPerMin)
      return res.status(429).json({ error: "Rate limit exceeded" });
    next();
  } catch (e) {
    next(e);
  }
}

export const adminOnly = (req, res, next) =>
  req.header("x-admin-secret") === config.adminSecret
    ? next()
    : res.status(403).json({ error: "Forbidden" });
