import { runInSandbox } from './sandbox.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(cfg) {
  const res = await fetch(cfg.url, {
    method: cfg.method || 'POST',
    headers: { 'content-type': 'application/json', ...(cfg.headers || {}) },
    body: cfg.method === 'GET' ? undefined : JSON.stringify(cfg.body ?? {}),
    signal: AbortSignal.timeout(cfg.timeoutMs || 10000),
  });
  if (!res.ok) { const e = new Error(`HTTP ${res.status} from ${cfg.url}`); e.status = res.status; throw e; }
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

// Each runner: (nodeData, ctx) => output.  ctx = { input, outputs }
export const runners = {
  start: async () => ({}),
  delay: async (d) => { await sleep(d.ms || 0); return {}; },
  http: async (d) => http(d),
  script: async (d, ctx) => ({ result: await runInSandbox(d.code, ctx, { timeout: d.timeoutMs || 1000 }) }),
  condition: async (d, ctx) => ({ branch: (await runInSandbox(d.expression, ctx)) ? 'true' : 'false' }),
};

// Compensation = the "undo" action attached to a node (saga pattern).
export async function compensate(node, ctx) {
  const c = node.data?.compensation;
  if (!c) return;
  if (c.type === 'http') await http(c);
  else if (c.type === 'script') await runInSandbox(c.code, ctx);
}
