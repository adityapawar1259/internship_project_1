import { Worker } from "node:worker_threads";

// User-defined scripts run in a separate Worker Thread with a hard memory cap and timeout,
// inside a fresh vm context that has no require/process/fetch.
// NOTE: for hostile multi-tenant production use, swap this for `isolated-vm` (V8 isolates).
const SRC = `
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
try {
  const result = vm.runInNewContext(workerData.code, { input: workerData.input }, { timeout: workerData.timeout });
  parentPort.postMessage({ ok: true, result: JSON.parse(JSON.stringify(result ?? null)) });
} catch (e) { parentPort.postMessage({ ok: false, error: String(e && e.message || e) }); }
`;

export function runInSandbox(
  code,
  input = {},
  { timeout = 1000, memoryMb = 64 } = {},
) {
  return new Promise((resolve, reject) => {
    const w = new Worker(SRC, {
      eval: true,
      workerData: { code, input, timeout },
      resourceLimits: { maxOldGenerationSizeMb: memoryMb },
    });
    const killer = setTimeout(() => {
      w.terminate();
      reject(new Error("Script timed out"));
    }, timeout + 300);
    w.once("message", (m) => {
      clearTimeout(killer);
      w.terminate();
      m.ok ? resolve(m.result) : reject(new Error(m.error));
    });
    w.once("error", (e) => {
      clearTimeout(killer);
      reject(e);
    });
  });
}
