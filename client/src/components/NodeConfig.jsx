import React from "react";

// Side-panel editor for the selected node: edit URL, script, retries, compensation (undo) action...
export default function NodeConfig({ node, onChange, onDelete }) {
  const d = node.data;
  const t = node.type;
  const set = (patch) => onChange(patch);
  const retry = d.retry || { attempts: 3, baseDelayMs: 500 };
  const comp = d.compensation || { type: "http", url: "", method: "POST" };
  return (
    <div>
      <div className="field">
        <label>Name</label>
        <input
          className="input"
          value={d.label || ""}
          onChange={(e) => set({ label: e.target.value })}
        />
      </div>

      {t === "http" && (
        <>
          <div className="row">
            <div className="field" style={{ flex: "0 0 100px" }}>
              <label>Method</label>
              <select
                className="input"
                value={d.method || "POST"}
                onChange={(e) => set({ method: e.target.value })}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>URL</label>
              <input
                className="input"
                placeholder="https://api.example.com/..."
                value={d.url || ""}
                onChange={(e) => set({ url: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>JSON body (optional)</label>
            <textarea
              className="input code"
              placeholder='{"orderId": 1}'
              value={d.bodyText || ""}
              onChange={(e) => set({ bodyText: e.target.value })}
            />
          </div>
          <h3>Retry policy</h3>
          <div className="row">
            <div className="field">
              <label>Max attempts</label>
              <input
                className="input"
                type="number"
                min="1"
                max="10"
                value={retry.attempts}
                onChange={(e) =>
                  set({ retry: { ...retry, attempts: Number(e.target.value) } })
                }
              />
            </div>
            <div className="field">
              <label>First delay (ms)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={retry.baseDelayMs}
                onChange={(e) =>
                  set({
                    retry: { ...retry, baseDelayMs: Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>
          <p className="muted small">
            Delay doubles after each failed attempt (exponential backoff). 4xx
            errors are not retried.
          </p>
          <h3>Undo action (saga compensation)</h3>
          <p className="muted small">
            Called if a LATER step fails permanently. Leave URL empty for no
            undo.
          </p>
          <div className="row">
            <select
              className="input"
              style={{ flex: "0 0 100px" }}
              value={comp.method || "POST"}
              onChange={(e) =>
                set({
                  compensation: {
                    ...comp,
                    type: "http",
                    method: e.target.value,
                  },
                })
              }
            >
              {["POST", "PUT", "DELETE", "GET"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              className="input"
              placeholder="https://api.example.com/undo"
              value={comp.url || ""}
              onChange={(e) =>
                set({
                  compensation: { ...comp, type: "http", url: e.target.value },
                })
              }
            />
          </div>
        </>
      )}

      {t === "delay" && (
        <div className="field">
          <label>Wait (milliseconds)</label>
          <input
            className="input"
            type="number"
            min="0"
            value={d.ms ?? 0}
            onChange={(e) => set({ ms: Number(e.target.value) })}
          />
        </div>
      )}

      {t === "script" && (
        <>
          <div className="field">
            <label>JavaScript (sandboxed, 1s limit)</label>
            <textarea
              className="input code"
              style={{ minHeight: 120 }}
              value={d.code || ""}
              onChange={(e) => set({ code: e.target.value })}
            />
          </div>
          <p className="muted small">
            Use <code>input</code> (workflow input, e.g. <code>input.n</code>)
            and <code>input.outputs.&lt;nodeId&gt;</code>. The last expression
            is the result, e.g. <code>({"{ total: input.a + input.b }"})</code>.
          </p>
        </>
      )}

      {t === "condition" && (
        <>
          <div className="field">
            <label>Expression (true / false)</label>
            <textarea
              className="input code"
              value={d.expression || ""}
              onChange={(e) => set({ expression: e.target.value })}
            />
          </div>
          <p className="muted small">
            Example: <code>input.amount &gt; 100</code>. Connect the green
            handle for TRUE and the red handle for FALSE.
          </p>
        </>
      )}

      {t === "start" && (
        <p className="muted small">
          Every workflow begins here. Connect it to your first step.
        </p>
      )}
      <p className="muted small mono">id: {node.id}</p>
      {t !== "start" && (
        <button className="btn danger sm" onClick={onDelete}>
          Delete node
        </button>
      )}
    </div>
  );
}
