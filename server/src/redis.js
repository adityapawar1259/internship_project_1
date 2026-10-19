import IORedis from "ioredis";
import { config } from "./config.js";
export const redisOpts = { maxRetriesPerRequest: null };
export const redis = new IORedis(config.redisUrl, redisOpts);
export const makeRedis = () => new IORedis(config.redisUrl, redisOpts);
