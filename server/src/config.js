import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Tiny .env loader avoids any runtime dependency for local configuration.
const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.env",
);
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined)
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const hours = Number(process.env.JWT_TTL_HOURS || 24);
export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/aditydb",
  dbName: process.env.MONGO_DB || "aditydb",
  adminSecret: process.env.ADMIN_SECRET || "change-me",
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-me",
  jwtTtlSec: Math.round(hours * 3600),
  allowSignup: process.env.ALLOW_SIGNUP !== "false",
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN || 600),
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : "http://localhost:5173",
};
