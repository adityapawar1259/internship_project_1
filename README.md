# Workflow Saga Engine — Starter

Starter backend for a multi-tenant visual workflow and Saga orchestration project. This first milestone includes workflow CRUD, tenant-scoped queries, and DAG validation. Background workers, retries, Saga compensation, and production authentication are planned next.

## Requirements

- Node.js 20+
- MongoDB running locally or a MongoDB connection URI

## Setup

```bash
npm install
```

Copy `.env.example` to `.env`, then set `MONGODB_URI` if your MongoDB URI differs.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Run in development:

```bash
npm run dev
```

Health check: `GET http://localhost:4000/health`

## API examples

For this development starter, send `x-tenant-id` with every workflow request. This is a temporary tenant selector for local learning only, **not authentication**. Do not expose this API publicly until it is replaced with verified user credentials and authorization.

Create a workflow:

```bash
curl -X POST http://localhost:4000/api/workflows \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: demo-company" \
  -d '{"name":"Example workflow","nodes":[{"id":"start","type":"start"},{"id":"finish","type":"end"}],"edges":[{"source":"start","target":"finish"}]}'
```

List workflows:

```bash
curl http://localhost:4000/api/workflows -H "x-tenant-id: demo-company"
```

Validate a workflow (replace `WORKFLOW_ID`):

```bash
curl -X POST http://localhost:4000/api/workflows/WORKFLOW_ID/validate -H "x-tenant-id: demo-company"
```

## Available scripts

- `npm run dev` — run with file watching
- `npm run typecheck` — check TypeScript types
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server

## Next milestones

1. Add update/delete workflow APIs and stronger graph validation.
2. Implement a sequential workflow executor and execution records.
3. Add Redis + BullMQ workers, retry policies, and idempotency.
4. Implement Saga compensation actions and crash recovery.
5. Add real authentication, API key hashing, rate limiting, and tenant authorization.
6. Build the React Flow frontend and tests.

## Important security note

The `x-tenant-id` header is only a learning scaffold. A client can choose its value. In a real deployment, derive the tenant from a verified session/token and enforce authorization in a shared middleware/data-access layer.

Our entry point of project is server.js
