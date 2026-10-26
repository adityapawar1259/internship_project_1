import React, { useEffect, useState } from "react";
import { api, fmtTime } from "../api.js";
import { useApp } from "../ctx.js";

export default function Dlq() {
  const { toast, setPage, refreshMe } = useApp();
  const [rows, setRows] = useState(null);
  const load = () =>
    api("/api/dlq")
      .then(setRows)
      .catch((e) => toast(e.message, "error"));
  useEffect(() => {
    load();
  }, []);
  const retry = async (r) => {
    try {
      await api(`/api/dlq/${r._id}/retry`, { method: "POST" });
      toast("Re-queued for execution", "success");
      refreshMe();
      setPage("executions");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Dead-letter queue</h2>
          <div className="muted">
            Executions that failed permanently and were rolled back. Fix the
            cause, then replay.
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
            <div className="big">🎉</div>The dead-letter queue is empty.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Execution</th>
                <th>Reason</th>
                <th>When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td className="mono">{r.executionId}</td>
                  <td>{r.reason}</td>
                  <td>{fmtTime(r.createdAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn sm primary" onClick={() => retry(r)}>
                      ↻ Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
