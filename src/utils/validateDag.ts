export type WorkflowNode = { id: string; type: string; config?: Record<string, unknown> };
export type WorkflowEdge = { source: string; target: string };

export function validateDag(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id?.trim()) errors.push('Every node must have a non-empty id.');
    else if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    ids.add(node.id);
  }

  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of ids) { indegree.set(id, 0); adjacency.set(id, []); }

  for (const edge of edges) {
    if (!ids.has(edge.source)) { errors.push(`Unknown source node: ${edge.source}`); continue; }
    if (!ids.has(edge.target)) { errors.push(`Unknown target node: ${edge.target}`); continue; }
    if (edge.source === edge.target) { errors.push(`Node ${edge.source} cannot connect to itself.`); continue; }
    adjacency.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    order.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }

  if (order.length !== ids.size) errors.push('Cycle detected: a DAG cannot contain cycles.');
  if (nodes.length > 0 && !nodes.some((node) => node.type === 'start')) errors.push('Workflow should contain a start node.');
  if (nodes.length > 0 && !nodes.some((node) => node.type === 'end')) errors.push('Workflow should contain an end node.');

  return { valid: errors.length === 0, errors, executionOrder: errors.length === 0 ? order : [] };
}
