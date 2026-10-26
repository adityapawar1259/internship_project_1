import React, { useEffect, useState } from "react";
import { api, fmtMs, fmtTime } from "../api.js";
import { useApp } from "../ctx.js";

export default function Executions() {
  const { socket, toast } = useApp();
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});
  const [open, setOpen] = useState(null);
  const load = () =>
    api("/api/executions")
      .then(setRows)
      .catch((e) => toast(e.message, "error"));
  useEffect(() => {
    api("/api/workflows")
      .then((w) => setNames(Object.fromEntries(w.map((x) => [x._id, x.name]))))
      .catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!socket) return;
    const f = (ev) => ev.type === "execution" && load();
    socket.on("trace", f);
    return () => socket.off("trace", f);
  }, [socket]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Executions</h2>
          <div className="muted">
            Latest 100 runs · click a row to see every step
          </div>
        </div>
        <button className="btn" onClick={load}>
          ↻ Refresh
        </button>
      </div>
      <div className="card">
        {rows === null ? (
          <div className="empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <div className="big">⚡</div>No executions yet. Run a workflow to
            see it here.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Steps</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r._id}>
                  <tr
                    className="click"
                    onClick={() => setOpen(open === r._id ? null : r._id)}
                  >
                    <td>
                      <b>{names[r.workflowId] || "Workflow"}</b>
                      <div className="mono muted">{r._id}</div>
                    </td>
                    <td>
                      <span className={`badge ${r.status}`}>{r.status}</span>
                    </td>
                    <td>{fmtTime(r.startedAt || r.createdAt)}</td>
                    <td>
                      {r.finishedAt && r.startedAt
                        ? fmtMs(new Date(r.finishedAt) - new Date(r.startedAt))
                        : "-"}
                    </td>
                    <td>{r.steps?.length || 0}</td>
                  </tr>
                  {open === r._id && (
                    <tr>
                      <td colSpan={5} style={{ background: "#fafbff" }}>
                        {r.error && (
                          <p style={{ color: "var(--bad)" }}>
                            <b>Error:</b> {r.error}
                          </p>
                        )}
                        <table className="steps">
                          <thead>
                            <tr>
                              <th>Node</th>
                              <th>Result</th>
                              <th>Attempts</th>
                              <th>Time</th>
                              <th>Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(r.steps || []).map((s, i) => (
                              <tr key={i}>
                                <td className="mono">{s.nodeId}</td>
                                <td>
                                  <span className={`badge ${s.state}`}>
                                    {s.state}
                                  </span>
                                </td>
                                <td>{s.attempts ?? "-"}</td>
                                <td>
                                  {s.durationMs != null
                                    ? fmtMs(s.durationMs)
                                    : "-"}
                                </td>
                                <td className="muted">{s.error || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
