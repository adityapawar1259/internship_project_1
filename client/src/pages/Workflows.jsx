import React, { useEffect, useState } from "react";
import { api, fmtTime } from "../api.js";
import { useApp } from "../ctx.js";

export default function Workflows() {
  const { toast, openBuilder, refreshMe, setPage } = useApp();
  const [list, setList] = useState(null);
  const load = () =>
    api("/api/workflows")
      .then(setList)
      .catch((e) => toast(e.message, "error"));
  useEffect(() => {
    load();
  }, []);

  const run = async (wf) => {
    const raw = window.prompt("Input JSON for this run:", '{"n": 7}');
    if (raw === null) return;
    let input;
    try {
      input = JSON.parse(raw || "{}");
    } catch {
      return toast("Not valid JSON", "error");
    }
    try {
      await api(`/api/workflows/${wf._id}/run`, {
        method: "POST",
        body: { input },
      });
      toast("Execution started", "success");
      refreshMe();
      setPage("executions");
    } catch (e) {
      toast(e.message, "error");
    }
  };
  const remove = async (wf) => {
    if (!window.confirm(`Delete "${wf.name}"?`)) return;
    await api(`/api/workflows/${wf._id}`, { method: "DELETE" });
    toast("Deleted");
    load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Workflows</h2>
          <div className="muted">Saved pipelines for this workspace</div>
        </div>
        <button className="btn primary" onClick={() => openBuilder(null)}>
          ＋ New workflow
        </button>
      </div>
      <div className="card">
        {list === null ? (
          <div className="empty">Loading…</div>
        ) : list.length === 0 ? (
          <div className="empty">
            <div className="big">🧩</div>No workflows yet. Build your first one
            in the Builder.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Steps</th>
                <th>Trigger event</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((wf) => (
                <tr key={wf._id}>
                  <td>
                    <b>{wf.name}</b>
                    <div className="mono muted">{wf._id}</div>
                  </td>
                  <td>{wf.graph.nodes.length}</td>
                  <td>
                    {wf.trigger?.event ? (
                      <span className="badge">{wf.trigger.event}</span>
                    ) : (
                      <span className="muted">manual</span>
                    )}
                  </td>
                  <td>{fmtTime(wf.createdAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn sm"
                      onClick={() => openBuilder(wf._id)}
                    >
                      Edit
                    </button>{" "}
                    <button className="btn sm primary" onClick={() => run(wf)}>
                      ▶ Run
                    </button>{" "}
                    <button
                      className="btn sm danger"
                      onClick={() => remove(wf)}
                    >
                      Delete
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