// Graph validation + topological ordering. Shared logic is mirrored in client/src/validate.js
export function validateGraph({ nodes = [], edges = [] } = {}) {
  const errors = [];
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) errors.push('Duplicate node ids');
  const starts = nodes.filter((n) => n.type === 'start');
  if (starts.length !== 1) errors.push(`Exactly one start node required (found ${starts.length})`);

  const out = new Map(nodes.map((n) => [n.id, []]));
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) { errors.push(`Edge ${e.id || ''} references a missing node`); continue; }
    out.get(e.source).push(e.target);
    indeg.set(e.target, indeg.get(e.target) + 1);
  }

  // Loop detection (Kahn's algorithm)
  const q = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
  const order = [];
  const deg = new Map(indeg);
  while (q.length) {
    const id = q.shift(); order.push(id);
    for (const t of out.get(id)) { deg.set(t, deg.get(t) - 1); if (deg.get(t) === 0) q.push(t); }
  }
  if (order.length !== nodes.length) errors.push('Cycle detected: workflow must be a DAG');

  // Orphans: everything must be reachable from the start node
  if (starts.length === 1) {
    const seen = new Set([starts[0].id]); const stack = [starts[0].id];
    while (stack.length) for (const t of out.get(stack.pop())) if (!seen.has(t)) { seen.add(t); stack.push(t); }
    for (const n of nodes) if (!seen.has(n.id)) errors.push(`Node "${n.id}" is not reachable from start`);
  }

  // Conditional branching: needs both a true and a false outgoing edge
  for (const n of nodes.filter((x) => x.type === 'condition')) {
    const handles = new Set(edges.filter((e) => e.source === n.id).map((e) => e.sourceHandle));
    if (!handles.has('true') || !handles.has('false')) errors.push(`Condition "${n.id}" needs both 'true' and 'false' edges`);
  }
  return { valid: errors.length === 0, errors, order };
}
