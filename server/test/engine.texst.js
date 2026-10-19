import test from "node:test";
import assert from "node:assert/strict";
import { validateGraph } from "../src/engine/dag.js";
import { runSaga } from "../src/engine/saga.js";
import { runInSandbox } from "../src/engine/sandbox.js";

const n = (id, type = "task", data = {}) => ({ id, type, data });
const e = (source, target, sourceHandle) => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle,
});

test("dag: detects cycles, orphans, bad conditions", () => {
  assert.ok(
    validateGraph({ nodes: [n("s", "start"), n("a")], edges: [e("s", "a")] })
      .valid,
  );
  assert.match(
    validateGraph({
      nodes: [n("s", "start"), n("a"), n("b")],
      edges: [e("s", "a"), e("a", "b"), e("b", "a")],
    }).errors.join(),
    /Cycle/,
  );
  assert.match(
    validateGraph({
      nodes: [n("s", "start"), n("x")],
      edges: [],
    }).errors.join(),
    /not reachable/,
  );
  assert.match(
    validateGraph({
      nodes: [n("s", "start"), n("c", "condition"), n("a")],
      edges: [e("s", "c"), e("c", "a", "true")],
    }).errors.join(),
    /true' and 'false'/,
  );
});

test("saga: success path and branching", async () => {
  const graph = {
    nodes: [n("s", "start"), n("c", "condition"), n("yes"), n("no")],
    edges: [e("s", "c"), e("c", "yes", "true"), e("c", "no", "false")],
  };
  const ran = [];
  const runners = {
    start: async () => ({}),
    condition: async () => ({ branch: "true" }),
    task: async (_d, _c) => ({}),
  };
  const r = await runSaga({
    graph,
    runners: {
      ...runners,
      task: async () => {
        ran.push("t");
        return {};
      },
    },
    compensate: async () => {},
  });
  assert.equal(r.status, "COMPLETED");
  assert.equal(ran.length, 1); // only "yes" branch ran
});

test("saga: retries with backoff, then compensates in reverse order", async () => {
  const graph = {
    nodes: [
      n("s", "start"),
      n("a", "task", { retry: { attempts: 3, baseDelayMs: 100 } }),
      n("b", "task"),
      n("c", "task", { retry: { attempts: 3, baseDelayMs: 100 } }),
    ],
    edges: [e("s", "a"), e("a", "b"), e("b", "c")],
  };
  const delays = [];
  const undone = [];
  let cCalls = 0;
  const r = await runSaga({
    graph,
    runners: {
      start: async () => ({}),
      task: async (d) => {
        if (d.retry && graph.nodes.find((x) => x.data === d).id === "c") {
          cCalls++;
          const er = new Error("503");
          er.status = 503;
          throw er;
        }
        return {};
      },
    },
    compensate: async (node) => {
      undone.push(node.id);
    },
    sleepFn: async (ms) => {
      delays.push(ms);
    },
  });
  assert.equal(r.status, "ROLLED_BACK");
  assert.equal(cCalls, 3);
  assert.deepEqual(delays, [100, 200]); // exponential backoff
  assert.deepEqual(undone, ["b", "a", "s"]); // reverse-order compensation
});

test("saga: 4xx errors are not retried", async () => {
  const graph = { nodes: [n("s", "start"), n("a")], edges: [e("s", "a")] };
  let calls = 0;
  const r = await runSaga({
    graph,
    runners: {
      start: async () => ({}),
      task: async () => {
        calls++;
        const er = new Error("400");
        er.status = 400;
        throw er;
      },
    },
    compensate: async () => {},
    sleepFn: async () => {},
  });
  assert.equal(calls, 1);
  assert.equal(r.status, "ROLLED_BACK");
});

test("sandbox: runs code, blocks require/process, enforces timeout", async () => {
  assert.deepEqual(
    await runInSandbox("({ total: input.a + input.b })", { a: 2, b: 3 }),
    { total: 5 },
  );
  await assert.rejects(runInSandbox('require("fs")'), /require is not defined/);
  await assert.rejects(
    runInSandbox("process.exit(1)"),
    /process is not defined/,
  );
  await assert.rejects(
    runInSandbox("while(true){}", {}, { timeout: 200 }),
    /timed out|Script execution/,
  );
});
