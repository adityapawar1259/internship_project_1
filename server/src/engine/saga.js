import { validateGraph } from "./dag.js";

export const STATES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "COMPENSATING",
  "ROLLED_BACK",
];
const ALLOWED = {
  PENDING: ["RUNNING"],
  RUNNING: ["COMPLETED", "FAILED", "COMPENSATING"],
  FAILED: ["COMPENSATING"],
  COMPENSATING: ["ROLLED_BACK", "FAILED"],
  COMPLETED: [],
  ROLLED_BACK: [],
};
export function transition(from, to) {
  if (!ALLOWED[from]?.includes(to))
    throw new Error(`Illegal transition ${from} -> ${to}`);
  return to;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEFAULT_RETRY = {
  attempts: 3,
  baseDelayMs: 500,
  factor: 2,
  maxDelayMs: 10000,
};
const isTransient = (e) => !e.status || e.status >= 500 || e.status === 429; // 4xx (except 429) won't succeed on retry

// Executes the DAG in topological order, honouring conditional branches.
// On permanent step failure: runs compensations of completed steps in REVERSE order.
export async function runSaga({
  graph,
  input = {},
  runners,
  compensate,
  onEvent = () => {},
  sleepFn = sleep,
  executionId,
}) {
  const v = validateGraph(graph);
  if (!v.valid) throw new Error("Invalid graph: " + v.errors.join("; "));
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const incoming = (id) => graph.edges.filter((e) => e.target === id);

  let status = transition("PENDING", "RUNNING");
  onEvent({ type: "execution", state: status });
  const outputs = {};
  const done = [];
  const skipped = new Set();

  try {
    for (const id of v.order) {
      const node = byId.get(id);
      const ins = incoming(id);
      // A node runs only if it's the start or at least one incoming edge is "live".
      const live =
        node.type === "start" ||
        ins.some((e) => {
          if (skipped.has(e.source) || !(e.source in outputs)) return false;
          const src = byId.get(e.source);
          return (
            src.type !== "condition" ||
            outputs[e.source].branch === e.sourceHandle
          );
        });
      if (!live) {
        skipped.add(id);
        onEvent({ type: "node", nodeId: id, state: "SKIPPED" });
        continue;
      }

      const policy = { ...DEFAULT_RETRY, ...(node.data?.retry || {}) };
      let attempt = 0;
      const t0 = Date.now();
      onEvent({ type: "node", nodeId: id, state: "RUNNING" });
      for (;;) {
        attempt++;
        try {
          outputs[id] =
            (await runners[node.type]?.(node.data || {}, {
              input,
              outputs,
              executionId,
              nodeId: id,
            })) ??
            (() => {
              throw new Error(`No runner for node type "${node.type}"`);
            })();
          done.push(id);
          onEvent({
            type: "node",
            nodeId: id,
            state: "COMPLETED",
            attempts: attempt,
            durationMs: Date.now() - t0,
            output: outputs[id],
          });
          break;
        } catch (err) {
          if (attempt >= policy.attempts || !isTransient(err)) {
            onEvent({
              type: "node",
              nodeId: id,
              state: "FAILED",
              attempts: attempt,
              durationMs: Date.now() - t0,
              error: err.message,
            });
            throw err;
          }
          const delay = Math.min(
            policy.baseDelayMs * policy.factor ** (attempt - 1),
            policy.maxDelayMs,
          );
          onEvent({
            type: "node",
            nodeId: id,
            state: "RETRYING",
            attempts: attempt,
            delayMs: delay,
            error: err.message,
          });
          await sleepFn(delay);
        }
      }
    }
    status = transition(status, "COMPLETED");
    onEvent({ type: "execution", state: status });
    return { status, outputs };
  } catch (err) {
    status = transition(status, "COMPENSATING");
    onEvent({ type: "execution", state: status, error: err.message });
    for (const id of [...done].reverse()) {
      try {
        await compensate(byId.get(id), { input, outputs, executionId });
        onEvent({ type: "node", nodeId: id, state: "COMPENSATED" });
      } catch (cerr) {
        onEvent({
          type: "node",
          nodeId: id,
          state: "COMPENSATION_FAILED",
          error: cerr.message,
        });
      }
    }
    status = transition(status, "ROLLED_BACK");
    onEvent({ type: "execution", state: status, error: err.message });
    return { status, outputs, error: err.message };
  }
}
