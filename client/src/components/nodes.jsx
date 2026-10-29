import React from "react";
import { Handle, Position } from "reactflow";

export const META = {
  start: { icon: "▶", title: "Start" },
  http: { icon: "🌐", title: "HTTP request" },
  delay: { icon: "⏱", title: "Delay" },
  script: { icon: "{ }", title: "Script" },
  condition: { icon: "⑂", title: "Condition" },
};

export const DEFAULTS = {
  start: { label: "Start" },
  http: {
    label: "HTTP request",
    url: "",
    method: "POST",
    bodyText: "",
    retry: { attempts: 3, baseDelayMs: 500 },
    compensation: { type: "http", url: "", method: "POST" },
  },
  delay: { label: "Delay", ms: 1000 },
  script: { label: "Script", code: "({ doubled: (input.n || 1) * 2 })" },
  condition: { label: "Condition", expression: "(input.n || 0) > 5" },
};

function summary(type, d) {
  if (type === "http") return `${d.method || "POST"} ${d.url || "(set URL)"}`;
  if (type === "delay") return `${d.ms || 0} ms`;
  if (type === "script") return (d.code || "").slice(0, 28);
  if (type === "condition") return d.expression || "";
  return "Entry point";
}

function Base({ data, type, selected }) {
  const m = META[type];
  return (
    <div
      className={`wf-node t-${type} ${selected ? "selected" : ""} ${data.state ? "state-" + data.state : ""}`}
    >
      {type !== "start" && <Handle type="target" position={Position.Top} />}
      <div className="wf-head">
        <span>{m.icon}</span>
        {m.title}
      </div>
      <div className="wf-body">
        {data.label}
        <small>
          {data.state
            ? `${data.state}${data.attempts > 1 ? ` (attempt ${data.attempts})` : ""}`
            : summary(type, data)}
        </small>
      </div>
      {type === "condition" ? (
        <>
          <div className="wf-branch">
            <span className="t">TRUE</span>
            <span className="f">FALSE</span>
          </div>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ left: "25%", background: "#16a34a" }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ left: "75%", background: "#dc2626" }}
          />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} />
      )}
    </div>
  );
}
// Defined once at module level so React Flow never re-creates them.
export const nodeTypes = Object.fromEntries(
  Object.keys(META).map((t) => [t, (props) => <Base {...props} type={t} />]),
);
