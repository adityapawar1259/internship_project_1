export const config = {
  port: process.env.PORT || 4000,
  mongoUri:
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/workflow?replicaSet=rs0",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  adminSecret: process.env.ADMIN_SECRET || "change-me",
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 50),
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN || 600),
};
