import { runInSandbox } from "./sandbox.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Scripts see the workflow input as `input` (e.g. input.n) and earlier step results as input.outputs.<nodeId>
const vars = (ctx) => ({ ...(ctx.input || {}), outputs: ctx.outputs || {} });

async function http(cfg, idemKey) {
  const res = await fetch(cfg.url, {
    method: cfg.method || "POST",
    headers: {
      "content-type": "application/json",
      ...(idemKey ? { "idempotency-key": idemKey } : {}),
      ...(cfg.headers || {}),
    },
    body:
      cfg.method === "GET"
        ? undefined
        : JSON.stringify(
            cfg.bodyText ? JSON.parse(cfg.bodyText) : (cfg.body ?? {}),
          ),
    signal: AbortSignal.timeout(cfg.timeoutMs || 10000),
  });
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} from ${cfg.url}`);
    e.status = res.status;
    throw e;
  }
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

// Each runner: (nodeData, ctx) => output.  ctx = { input, outputs }
export const runners = {
  start: async () => ({}),
  delay: async (d) => {
    await sleep(d.ms || 0);
    return {};
  },
  http: async (d, ctx) =>
    http(d, ctx.executionId ? `${ctx.executionId}:${ctx.nodeId}` : undefined),
  script: async (d, ctx) => ({
    result: await runInSandbox(d.code, vars(ctx), {
      timeout: d.timeoutMs || 1000,
    }),
  }),
  condition: async (d, ctx) => ({
    branch: (await runInSandbox(d.expression, vars(ctx))) ? "true" : "false",
  }),
};

// Compensation = the "undo" action attached to a node (saga pattern).
export async function compensate(node, ctx) {
  const c = node.data?.compensation;
  if (!c) return;
  if (c.type === "http")
    await http(
      c,
      ctx.executionId ? `${ctx.executionId}:${node.id}:undo` : undefined,
    );
  else if (c.type === "script") await runInSandbox(c.code, vars(ctx));
}
