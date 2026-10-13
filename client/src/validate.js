// Instant client-side validation (the server re-validates; never trust the client).
export function validate(nodes, edges) {
  const errors = [];
  const starts = nodes.filter((n) => n.type === "start");
  if (starts.length !== 1)
    errors.push(`Need exactly one Start node (have ${starts.length})`);
  const out = new Map(nodes.map((n) => [n.id, []]));
  const deg = new Map(nodes.map((n) => [n.id, 0]));
  edges.forEach((e) => {
    out.get(e.source)?.push(e.target);
    deg.set(e.target, (deg.get(e.target) || 0) + 1);
  });
  const q = [...deg].filter(([, d]) => d === 0).map(([id]) => id);
  let seen = 0;
  while (q.length) {
    const id = q.shift();
    seen++;
    out.get(id).forEach((t) => {
      deg.set(t, deg.get(t) - 1);
      if (deg.get(t) === 0) q.push(t);
    });
  }
  if (seen !== nodes.length)
    errors.push("Loop detected: workflow must be acyclic");
  nodes
    .filter((n) => n.type === "condition")
    .forEach((n) => {
      const h = new Set(
        edges.filter((e) => e.source === n.id).map((e) => e.sourceHandle),
      );
      if (!h.has("true") || !h.has("false"))
        errors.push(
          `Condition "${n.data.label || n.id}" needs both true and false branches`,
        );
    });
  return errors;
}
