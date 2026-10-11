import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { workflowsRouter } from './routes/workflows';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'workflow-saga-engine' }));
app.use('/api/workflows', workflowsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  if (message.startsWith('Missing x-tenant-id')) return res.status(400).json({ error: message });
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT ?? 4000);
const mongoUri = process.env.MONGODB_URI;

async function start() {
  if (!mongoUri) throw new Error('MONGODB_URI is not configured. Copy .env.example to .env.');
  await mongoose.connect(mongoUri);
  app.listen(port, () => console.log(`Workflow Saga Engine API listening on http://localhost:${port}`));
}

start().catch((error) => { console.error('Failed to start server:', error); process.exit(1); });
