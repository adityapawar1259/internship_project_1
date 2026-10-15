# Distributed Workflow Automation Engine

React DAG builder + Node.js saga coordinator (BullMQ workers, MongoDB, Socket.IO).

## Run locally

```bash
docker compose up --build            # mongo(replica set) + redis + api + 2 workers + client
# create a tenant (returns API key once):
curl -X POST localhost:4000/api/tenants -H 'x-admin-secret: change-me' -H 'content-type: application/json' -d '{"name":"acme"}'
# open http://localhost:8080 , paste the API key, build a graph, Save, Run.
```

Tests (no services needed): `cd server && npm install && npm test`

## Project layout

- `server/src/engine` - dag.js (validation/loop detection), saga.js (state machine + retries + compensation), sandbox.js, runners.js
- `server/src` - api (routes, middleware), worker.js, sockets.js, changeStreams.js, queue.js (DLQ)
- `client/src` - App.jsx (canvas + live trace), Dashboard.jsx, validate.js
- `loadtest/k6.js` - 1,000+ concurrent pipelines
- `docs/failure-recovery.md`

## Deploy to AWS (stay inside the $200 credit)

1. Create billing alerts (AWS Budgets at $50/$150).
2. MongoDB Atlas (M0/M10, replica set included) + Upstash/ElastiCache Redis.
3. `aws ecr create-repository` x3; build & push `server`, `client` images.
4. ECS Fargate: service `api` (behind ALB, port 4000, health `/health`), service `worker` (no LB, `node src/worker.js`).
   Env: MONGO_URI, REDIS_URL, ADMIN_SECRET (use Secrets Manager).
5. Auto-scale `worker` service: target-tracking on CPU 60%, min 2 / max 10.
6. Frontend: build with `VITE_API_URL=https://<alb-dns>` -> S3 + CloudFront (or the nginx container).
7. Delete NAT gateways/ALBs you are not using; they are the main credit burners.
8. Run `k6` against the ALB, record p95 + error rate in your report.
