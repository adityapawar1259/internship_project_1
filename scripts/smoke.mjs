// Usage: node scripts/smoke.mjs     (needs Node 18+, stack running via docker compose)
const API = process.env.API || "http://localhost:4000";
import { readFileSync } from "node:fs";
let fileEnv = {};
try {
  fileEnv = Object.fromEntries(
    readFileSync(new URL("../.env", import.meta.url), "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [
        l.slice(0, l.indexOf("=")).trim(),
        l.slice(l.indexOf("=") + 1).trim(),
      ]),
  );
} catch {}
const ADMIN = process.env.ADMIN_SECRET || fileEnv.ADMIN_SECRET || "change-me";
const INTERNAL = process.env.INTERNAL_API || "http://api:4000"; // how the *worker container* reaches the API
let KEY;
const call = async (path, method = "GET", body, admin) => {
  const r = await fetch(API + path, {
    method,
    body: body && JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(admin ? { "x-admin-secret": ADMIN } : { "x-api-key": KEY }),
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 202)
    throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
};
const wait = async (id) => {
  for (let i = 0; i < 60; i++) {
    const e = await call(`/api/executions/${id}`);
    if (["COMPLETED", "ROLLED_BACK", "FAILED"].includes(e.status)) return e;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("timeout waiting for execution");
};
const n = (id, type, data = {}) => ({ id, type, data });
const e = (s, t, h) => ({
  id: `${s}-${t}`,
  source: s,
  target: t,
  sourceHandle: h,
});
let failed = false;
const check = (ok, msg) => {
  console.log(ok ? "PASS" : "FAIL", msg);
  if (!ok) failed = true;
};

// 0) accounts: sign-up validation, login, wrong password, logout really invalidates the token
const post = async (path, body, token) => {
  const r = await fetch(API + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const email = `smoke${Date.now()}@example.com`;
const pw = "Smoke1234";
check(
  (await post("/api/auth/register", { name: "S", email: "bad", password: "x" }))
    .status === 400,
  "sign-up rejects invalid input (400)",
);
const reg = await post("/api/auth/register", {
  name: "Smoke Tester",
  email,
  password: pw,
});
check(
  reg.status === 201 && !!reg.body.token,
  "sign-up creates an account and returns a token",
);
check(
  (
    await post("/api/auth/register", {
      name: "Smoke Tester",
      email,
      password: pw,
    })
  ).status === 409,
  "duplicate email rejected (409)",
);
check(
  (await post("/api/auth/login", { email, password: "Wrong1234" })).status ===
    401,
  "wrong password rejected (401)",
);
const lg = await post("/api/auth/login", { email, password: pw });
check(lg.status === 200 && !!lg.body.token, "login returns a token");
const meRes = await fetch(API + "/api/me", {
  headers: { authorization: `Bearer ${lg.body.token}` },
});
check(
  meRes.status === 200 && (await meRes.json()).user?.email === email,
  "/api/me works with the token",
);
check((await fetch(API + "/api/me")).status === 401, "no token -> 401");
await post("/api/auth/logout", {}, lg.body.token);
check(
  (
    await fetch(API + "/api/me", {
      headers: { authorization: `Bearer ${lg.body.token}` },
    })
  ).status === 401,
  "token is rejected after logout",
);

const t = await call(
  "/api/tenants",
  "POST",
  { name: "smoke-" + Date.now(), monthlyQuota: 1000000 },
  true,
);
KEY = t.apiKey;
console.log("Tenant created. API key:", KEY);

// A) happy path with a conditional branch (no internet needed)
const A = await call("/api/workflows", "POST", {
  name: "happy",
  graph: {
    nodes: [
      n("start", "start"),
      n("calc", "script", { code: "({ doubled: input.n * 2 })" }),
      n("check", "condition", { expression: "input.n > 5" }),
      n("big", "delay", { ms: 100 }),
      n("small", "delay", { ms: 100 }),
    ],
    edges: [
      e("start", "calc"),
      e("calc", "check"),
      e("check", "big", "true"),
      e("check", "small", "false"),
    ],
  },
});
const ea = await wait(
  (await call(`/api/workflows/${A._id}/run`, "POST", { input: { n: 7 } }))._id,
);
check(ea.status === "COMPLETED", `happy workflow -> ${ea.status}`);
check(
  ea.steps.some((s) => s.nodeId === "big" && s.state === "COMPLETED") &&
    ea.steps.some((s) => s.nodeId === "small" && s.state === "SKIPPED"),
  "condition took the TRUE branch only",
);

// B) failure path: step 2 returns 500 -> retries -> rollback -> dead-letter queue
const B = await call("/api/workflows", "POST", {
  name: "fails",
  graph: {
    nodes: [
      n("start", "start"),
      n("ok", "http", {
        url: `${INTERNAL}/debug/status/200`,
        compensation: { type: "http", url: `${INTERNAL}/debug/status/200` },
      }),
      n("boom", "http", {
        url: `${INTERNAL}/debug/status/500`,
        retry: { attempts: 3, baseDelayMs: 200 },
      }),
    ],
    edges: [e("start", "ok"), e("ok", "boom")],
  },
});
const eb = await wait(
  (await call(`/api/workflows/${B._id}/run`, "POST", { input: {} }))._id,
);
check(eb.status === "ROLLED_BACK", `failing workflow -> ${eb.status}`);
check(
  eb.steps.some(
    (s) => s.nodeId === "boom" && s.state === "FAILED" && s.attempts === 3,
  ),
  "failing step retried 3 times",
);
check(
  eb.steps.some((s) => s.nodeId === "ok" && s.state === "COMPENSATED"),
  "completed step was compensated (saga rollback)",
);
await new Promise((r) => setTimeout(r, 500));
check(
  (await call("/api/dlq")).length >= 1,
  "failed execution landed in the dead-letter queue",
);

// C) Change Stream trigger: inserting an event starts a workflow by itself
const C = await call("/api/workflows", "POST", {
  name: "event-driven",
  trigger: { event: "order.created" },
  graph: { nodes: [n("start", "start")], edges: [] },
});
await call("/api/events", "POST", { type: "order.created", payload: { n: 1 } });
await new Promise((r) => setTimeout(r, 3000));
const ex = await call("/api/executions");
check(
  ex.some((x) => String(x.workflowId) === String(C._id)),
  "Change Stream auto-triggered the workflow",
);
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
