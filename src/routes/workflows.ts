import { Router } from 'express';
import { z } from 'zod';
import { Workflow } from '../models/Workflow';
import { validateDag } from '../utils/validateDag';

export const workflowsRouter = Router();

// Starter-only tenant context. Replace this header with verified authentication before deployment.
function getTenantId(req: import('express').Request) {
  const tenantId = req.header('x-tenant-id')?.trim();
  if (!tenantId) throw new Error('Missing x-tenant-id header.');
  return tenantId;
}

const workflowInput = z.object({
  name: z.string().trim().min(1).max(120),
  nodes: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['start', 'http', 'condition', 'task', 'end']),
    config: z.record(z.unknown()).optional()
  })).default([]),
  edges: z.array(z.object({ source: z.string().min(1), target: z.string().min(1) })).default([])
});

workflowsRouter.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const input = workflowInput.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: 'Invalid workflow input', details: input.error.flatten() });
    const workflow = await Workflow.create({ tenantId, ...input.data });
    return res.status(201).json({ workflow });
  } catch (error) { return next(error); }
});

workflowsRouter.get('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const workflows = await Workflow.find({ tenantId }).sort({ createdAt: -1 }).lean();
    return res.json({ workflows });
  } catch (error) { return next(error); }
});

workflowsRouter.get('/:id', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const workflow = await Workflow.findOne({ _id: req.params.id, tenantId }).lean();
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    return res.json({ workflow });
  } catch (error) { return next(error); }
});

workflowsRouter.post('/:id/validate', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const workflow = await Workflow.findOne({ _id: req.params.id, tenantId }).lean();
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    return res.json(validateDag(workflow.nodes, workflow.edges));
  } catch (error) { return next(error); }
});
