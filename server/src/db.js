// ============================================================
//  DATABASE CONNECTION - the ONLY file that talks to MongoDB's connect().
//  Database name comes from MONGO_DB (default: aditydb), link from MONGO_URI.
// ============================================================
import mongoose from "mongoose";
import { config } from "./config.js";

mongoose.set("strictQuery", true);
let wired = false;

export async function connectDb() {
  if (!wired) {
    wired = true;
    mongoose.connection.on("error", (e) =>
      console.error("MongoDB error:", e.message),
    );
    mongoose.connection.on("disconnected", () =>
      console.warn("MongoDB disconnected"),
    );
    mongoose.connection.on("reconnected", () =>
      console.log("MongoDB reconnected"),
    );
  }
  try {
    await mongoose.connect(config.mongoUri, {
      dbName: config.dbName,
      serverSelectionTimeoutMS: 15000,
    });
  } catch (e) {
    console.error(
      `\nCould not connect to MongoDB: ${e.message}\nCheck MONGO_URI in your .env file (and that MongoDB is running / your IP is allowed in Atlas).\n`,
    );
    throw e;
  }
  console.log(`MongoDB connected -> database "${mongoose.connection.name}"`);
  return mongoose.connection;
}

export const dbState = () =>
  ["disconnected", "connected", "connecting", "disconnecting"][
    mongoose.connection.readyState
  ] || "unknown";
export const dbName = () => mongoose.connection.name || config.dbName;

// Every collection in the database with its document count (used by `npm run db:show`).
export async function listAllCollections() {
  const db = mongoose.connection.db;
  const cols = (await db.listCollections().toArray()).map((c) => c.name).sort();
  return Promise.all(
    cols.map(async (name) => ({
      name,
      documents: await db.collection(name).estimatedDocumentCount(),
    })),
  );
}
