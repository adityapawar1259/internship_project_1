// Usage:  npm run db:show            -> every collection in the database with counts + 2 sample documents
//         npm run db:show -- users 10  -> up to 10 documents of one collection
import mongoose from "mongoose";
import { connectDb, dbName, listAllCollections } from "../src/db.js";

const [onlyName, limitArg] = process.argv.slice(2);
const SECRET = /hash|password|secret/i;
const mask = (d) =>
  JSON.parse(
    JSON.stringify(d, (k, v) => (SECRET.test(k) ? "***hidden***" : v)),
  );

await connectDb();
console.log(`\nDatabase: ${dbName()}\n`);
const cols = await listAllCollections();
if (!cols.length)
  console.log(
    "(no collections yet - register a user and create a workflow first)",
  );
for (const c of cols) {
  if (onlyName && c.name !== onlyName) continue;
  console.log(`== ${c.name}  (${c.documents} documents)`);
  const docs = await mongoose.connection.db
    .collection(c.name)
    .find({})
    .sort({ _id: -1 })
    .limit(Number(limitArg) || 2)
    .toArray();
  for (const d of docs) console.log(JSON.stringify(mask(d)).slice(0, 300));
  console.log("");
}
await mongoose.disconnect();
