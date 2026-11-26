import { Tenant } from "./models.js";

// Atomically consumes one execution from the tenant's monthly quota. Resets automatically each new month.
export async function consumeQuota(tenantId) {
  const ym = new Date().toISOString().slice(0, 7);
  await Tenant.updateOne(
    { _id: tenantId, quotaMonth: { $ne: ym } },
    { $set: { quotaMonth: ym, usedThisMonth: 0 } },
  );
  const t = await Tenant.findOneAndUpdate(
    { _id: tenantId, $expr: { $lt: ["$usedThisMonth", "$monthlyQuota"] } },
    { $inc: { usedThisMonth: 1 } },
    { new: true },
  );
  return !!t;
}
