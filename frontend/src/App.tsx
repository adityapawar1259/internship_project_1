import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";

const initialNodes: Node[] = [
  {
    id: "start",
    position: { x: 80, y: 140 },
    data: { label: "Start" },
    type: "input",
  },
  {
    id: "task1",
    position: { x: 300, y: 140 },
    data: { label: "Task: Hello" },
    type: "default",
  },
  {
    id: "end",
    position: { x: 540, y: 140 },
    data: { label: "End" },
    type: "output",
  },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "start", target: "task1" },
  { id: "e2", source: "task1", target: "end" },
];

const kind = (label: string): string =>
  label.toLowerCase().startsWith("start")
    ? "start"
    : label.toLowerCase().startsWith("end")
      ? "end"
      : label.toLowerCase().startsWith("http")
        ? "http"
        : label.toLowerCase().startsWith("condition")
          ? "condition"
          : "task";

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [name, setName] = useState("My workflow");
  const [tenant, setTenant] = useState("demo-company");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState(
    "Canvas ready. Start the backend and create the demo-company tenant to save.",
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((es) => addEdge(connection, es)),
    [setEdges],
  );

  function addNode(type: string) {
    const id = `${type}-${Date.now().toString().slice(-6)}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        position: { x: 150 + Math.random() * 420, y: 80 + Math.random() * 260 },
        data: {
          label:
            type === "http"
              ? "HTTP"
              : type === "condition"
                ? "Condition"
                : type === "end"
                  ? "End"
                  : "Task",
        },
        type:
          type === "start" ? "input" : type === "end" ? "output" : "default",
      },
    ]);
  }

  function graph() {
    return {
      name,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: kind(String(n.data.label)),
        config:
          kind(String(n.data.label)) === "task"
            ? { message: String(n.data.label) }
            : {},
      })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        label: String(e.label ?? ""),
      })),
    };
  }

  function validateLocal() {
    const g = graph();
    const ids = new Set(g.nodes.map((n) => n.id));
    const errors: string[] = [];

    if (g.nodes.filter((n) => n.type === "start").length !== 1)
      errors.push("Use exactly one Start node.");
    if (!g.nodes.some((n) => n.type === "end")) errors.push("Add an End node.");

    for (const e of g.edges) {
      if (!ids.has(e.source) || !ids.has(e.target))
        errors.push("An edge points to a missing node.");
    }

    const indegree = new Map(g.nodes.map((n) => [n.id, 0]));
    const adj = new Map(g.nodes.map((n) => [n.id, [] as string[]]));

    g.edges.forEach((e) => {
      adj.get(e.source)?.push(e.target);
      indegree.set(e.target, (indegree.get(e.target) || 0) + 1);
    });

    const q = [...indegree].filter(([, d]) => d === 0).map(([id]) => id);
    let visited = 0;

    while (q.length) {
      const id = q.shift()!;
      visited++;
      for (const next of adj.get(id) || []) {
        indegree.set(next, (indegree.get(next) || 0) - 1);
        if (indegree.get(next) === 0) q.push(next);
      }
    }

    if (visited !== g.nodes.length)
      errors.push("Cycle detected. DAG workflows cannot contain loops.");

    setStatus(
      errors.length
        ? `Invalid graph:\n- ${errors.join("\n- ")}`
        : "Local validation passed. Save to run full backend validation.",
    );
  }

  async function request(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-tenant-id": tenant,
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    };

    const r = await fetch(`http://localhost:4000${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    const data = r.status === 204 ? null : await r.json();
    if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }

  async function save() {
    try {
      const data = await request("/api/workflows", {
        method: "POST",
        body: JSON.stringify(graph()),
      });
      setStatus(`Saved workflow ID: ${data.workflow._id}`);
    } catch (e) {
      setStatus(
        `Save failed: ${e instanceof Error ? e.message : String(e)}\nCreate tenant first via POST /api/tenants.`,
      );
    }
  }

  async function run() {
    try {
      const match = status.match(/Saved workflow ID: ([a-f0-9]+)/i);
      if (!match) {
        setStatus("Save the workflow first, then click Run.");
        return;
      }
      const data = await request(`/api/workflows/${match[1]}/run`, {
        method: "POST",
        body: JSON.stringify({ input: {} }),
      });
      setStatus(
        `Execution state: ${data.execution.state}\nExecution ID: ${data.execution._id}`,
      );
    } catch (e) {
      setStatus(`Run failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">WORKFLOW SAGA ENGINE</p>
          <h1>Workflow canvas</h1>
          <p className="sub">
            Build a directed acyclic graph, validate it, then save and execute
            it.
          </p>
        </div>
        <div className="actions">
          <button onClick={validateLocal}>Validate graph</button>
          <button className="primary" onClick={save}>
            Save workflow
          </button>
          <button onClick={run}>Run workflow</button>
        </div>
      </header>
      <section className="settings">
        <label>
          Workflow name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Tenant slug
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} />
        </label>
        <label>
          API key (only if enabled) 
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Optional local key"
          />
        </label>
      </section>
      <nav className="palette">
        <span>Add node:</span>
        <button onClick={() => addNode("task")}>+ Task</button>
        <button onClick={() => addNode("condition")}>+ Condition</button>
        <button onClick={() => addNode("http")}>+ HTTP</button>
        <button onClick={() => addNode("end")}>+ End</button>
        <span className="hint">
          Drag nodes · connect handles · avoid cycles
        </span>
      </nav>
      <div className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <section className="result">
        <h2>Project status</h2>
        <pre>{status}</pre>
      </section>
      <footer>
        Local development only · Do not expose the API publicly before adding
        administrator authentication and SSRF protections.
      </footer>
    </main>
  );
}
