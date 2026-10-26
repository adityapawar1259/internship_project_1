// Instant client-side validation (the server validates again; never trust the client).
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
    errors.push("Loop detected: a workflow must not contain cycles");

  if (starts.length === 1) {
    const reach = new Set([starts[0].id]);
    const st = [starts[0].id];
    while (st.length)
      out.get(st.pop())?.forEach((t) => {
        if (!reach.has(t)) {
          reach.add(t);
          st.push(t);
        }
      });
    nodes
      .filter((n) => !reach.has(n.id))
      .forEach((n) =>
        errors.push(`"${n.data.label || n.id}" is not connected to Start`),
      );
  }
  nodes
    .filter((n) => n.type === "condition")
    .forEach((n) => {
      const h = new Set(
        edges.filter((e) => e.source === n.id).map((e) => e.sourceHandle),
      );
      if (!h.has("true") || !h.has("false"))
        errors.push(
          `Condition "${n.data.label || n.id}" needs both a TRUE and a FALSE branch`,
        );
    });
  nodes
    .filter((n) => n.type === "http")
    .forEach((n) => {
      if (!n.data.url)
        errors.push(`HTTP node "${n.data.label || n.id}" needs a URL`);
      if (n.data.bodyText) {
        try {
          JSON.parse(n.data.bodyText);
        } catch {
          errors.push(
            `HTTP node "${n.data.label || n.id}": body is not valid JSON`,
          );
        }
      }
    });
  nodes
    .filter((n) => n.type === "script" && !n.data.code)
    .forEach((n) =>
      errors.push(`Script node "${n.data.label || n.id}" has no code`),
    );
  nodes
    .filter((n) => n.type === "condition" && !n.data.expression)
    .forEach((n) =>
      errors.push(`Condition "${n.data.label || n.id}" has no expression`),
    );
  return errors;
}
