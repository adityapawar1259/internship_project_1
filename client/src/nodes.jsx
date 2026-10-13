import React from "react";
import { Handle, Position } from "reactflow";

const box = (bg) => ({
  padding: 8,
  borderRadius: 8,
  border: "2px solid #334",
  background: bg,
  minWidth: 130,
  fontSize: 12,
});
export const stateColor = {
  RUNNING: "#fde68a",
  COMPLETED: "#bbf7d0",
  FAILED: "#fecaca",
  RETRYING: "#fed7aa",
  COMPENSATED: "#ddd6fe",
  SKIPPED: "#e5e7eb",
};

const Base = ({ data, type }) => (
  <div style={box(stateColor[data.state] || "#fff")}>
    {type !== "start" && <Handle type="target" position={Position.Top} />}
    <b>{type}</b>
    <div>{data.label}</div>
    {data.state && (
      <small>
        {data.state}
        {data.attempts > 1 ? ` (x${data.attempts})` : ""}
      </small>
    )}
    {type === "condition" ? (
      <>
        <Handle
          id="true"
          type="source"
          position={Position.Bottom}
          style={{ left: "30%", background: "green" }}
        />
        <Handle
          id="false"
          type="source"
          position={Position.Bottom}
          style={{ left: "70%", background: "red" }}
        />
      </>
    ) : (
      <Handle type="source" position={Position.Bottom} />
    )}
  </div>
);
export const nodeTypes = Object.fromEntries(
  ["start", "http", "delay", "script", "condition"].map((t) => [
    t,
    (p) => <Base {...p} type={t} />,
  ]),
);
