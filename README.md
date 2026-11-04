# FlowForge - Distributed Workflow Automation Engine

Visual DAG builder (React Flow) + Node.js saga engine (BullMQ workers, MongoDB, Redis, Socket.IO) with user accounts (register / login / logout).
Your MongoDB database is **`aditydb`**.

## 0. What was updated in this version
| Area | Change |
|---|---|
| Login / logout | NEW real accounts: **Create account** + **Sign in** + **Sign out** (JWT tokens, scrypt-hashed passwords). Logout invalidates the token on the server (Redis deny-list). Expired sessions send you back to the login page automatically. |
| Validation | Name, email format, password rules (8+ chars, letter + number), confirm password, strength bar, inline errors on the page **and** re-checked on the server. Login is rate-limited (10 tries / 15 min per email+IP), sign-up 20 / hour per IP. |
| Database | Separate connection file `server/src/db.js`. Database name `aditydb` (`MONGO_DB`). Logs the connected DB on start, `/health` reports DB state. New `npm run db:show` lists **every collection** with counts and samples. Dashboard has a **Database** card. |
| API | New `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/db/overview`. `/api/me` now returns the signed-in user. Scripts can still use `x-api-key`. |
| Bug fixes | Clearing a workflow's trigger now really clears it; invalid JSON / bad ids return 400 instead of 500; retrying a dead letter whose execution is gone no longer crashes; workers handle deleted workflows and no longer duplicate steps on retry; event `type` is required. |
| Pages | Login, Builder, Workflows, Executions, Dead letters, Dashboard all use the new session. Responsive layout for small screens. |
| Tests | `server/test/auth.test.js` (password hashing, token tamper/expiry, validation) + extended `scripts/smoke.mjs` (sign-up, login, wrong password, logout). |

## 1. Install once
- Docker Desktop https://www.docker.com/products/docker-desktop  (Options A and B)
- Node.js 20+ https://nodejs.org  (smoke test, tests, and Option C)

## 2. WHERE TO PUT YOUR LINKS AND SECRETS (everything in one table)

| What | File | Variable | Example |
|---|---|---|---|
| MongoDB link (cloud) | `.env` (root) for Docker  ·  `server/.env` without Docker | `MONGO_URI` | `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/aditydb?retryWrites=true&w=majority` |
| Database name | same files | `MONGO_DB` | `aditydb` (default) |
| Redis link (cloud) | same files | `REDIS_URL` | `rediss://default:PASS@host:6379` (local: `redis://localhost:6379`) |
| Login token secret | same files | `JWT_SECRET` | any long random text (change it before deploying!) |
| Login lifetime | same files | `JWT_TTL_HOURS` | `24` |
| Allow new sign-ups | same files | `ALLOW_SIGNUP` | `true` (set `false` to close registration) |
| Admin password (scripts only) | same files | `ADMIN_SECRET` | used by `scripts/smoke.mjs` and `POST /api/tenants` |
| API address seen by the browser | `.env` (root) for Docker  ·  `client/.env` without Docker | `VITE_API_URL` | `http://localhost:4000` (deployed: `https://api.yourdomain.com`) |
| Allowed website origin(s) | `.env` / `server/.env` | `CORS_ORIGIN` | `*` locally, `https://app.yourdomain.com` in production |

If you use **Option A** you do NOT need any MongoDB/Redis link - Docker creates them (the database is still called `aditydb`).

## 3. Pick ONE way to run

### Option A - everything local in Docker (easiest, no accounts)
```
docker compose up --build
```
Wait for `MongoDB connected -> database "aditydb"`, `API on :4000` and `Worker up`, then open **http://localhost:8080**.

### Option B - Docker + your own MongoDB Atlas and Redis
1. MongoDB Atlas (free): https://www.mongodb.com/cloud/atlas -> create cluster -> Database Access (create user) -> Network Access (allow your IP or 0.0.0.0/0) -> Connect -> Drivers -> copy the link, make sure `/aditydb` is before the `?`.
2. Redis (free): https://redis.io/try-free (Redis Cloud) or https://upstash.com -> copy the `rediss://...` link.
3. In the root `.env` remove the `#` in front of `MONGO_URI` and `REDIS_URL` and paste your links.
4. `docker compose -f docker-compose.cloud.yml up --build`  -> open http://localhost:8080

### Option C - no Docker (3 terminals)
1. Put your links in `server/.env` (MONGO_URI must be Atlas or another replica set).
2. Terminal 1: `cd server && npm install && npm run api`
3. Terminal 2: `cd server && npm run worker`
4. Terminal 3: `cd client && npm install && npm run dev` -> open http://localhost:5173

## 4. First use
1. Open the site -> **Create account** -> name, email, password (8+ characters with a letter and a number) -> you are signed in. Next time use **Sign in**. **Sign out** is at the bottom of the left menu.
2. **Builder**: add nodes, drag from a node's bottom dot to the next node's top dot, click a node to edit it (URL, script, retries, undo action), then **Save & Run** and watch the nodes light up.
3. **Workflows**: your saved pipelines (edit, run with JSON input, delete).
4. **Executions**: every run with per-step results. **Dead letters**: failed runs, with Retry.
5. **Dashboard**: quota, latency chart, failure heatmap and the **Database** card (documents stored in `aditydb` for your workspace).

Each account gets its own private workspace (tenant): you only ever see your own workflows, runs and dead letters.

## 5. See everything in the database
```
cd server
npm run db:show               # every collection in aditydb, with counts and 2 sample documents
npm run db:show -- users 10   # up to 10 documents of one collection (password hashes are hidden)
```
Collections: `users`, `tenants`, `apikeys`, `workflows`, `executions`, `events`, `deadletters`.
You can also open `aditydb` in MongoDB Compass / Atlas "Browse Collections" with the same link.

## 6. Check everything works (30 seconds)
```
cd server && npm install && npm test     # engine + auth unit tests (no database needed)
node scripts/smoke.mjs                   # needs Option A or B running; prints ALL CHECKS PASSED
```

## 7. API summary
| Method + path | Auth | What |
|---|---|---|
| `POST /api/auth/register` `{name,email,password,workspace?}` | none | create account + workspace, returns `token` |
| `POST /api/auth/login` `{email,password}` | none | returns `token` |
| `POST /api/auth/logout` | Bearer | invalidates the token |
| `GET /api/me`, `GET /api/db/overview`, `GET /api/metrics` | Bearer | profile+quota, DB counts, dashboard data |
| `GET/POST /api/workflows`, `GET/PUT/DELETE /api/workflows/:id`, `POST /api/workflows/:id/run` | Bearer | workflows |
| `GET /api/executions`, `GET /api/executions/:id` | Bearer | runs |
| `POST /api/events` `{type,payload}` | Bearer | fires workflows whose trigger event matches |
| `GET /api/dlq`, `POST /api/dlq/:id/retry` | Bearer | dead letters |
| `GET /health` | none | `{ok, db, state}` (503 if the database is down) |

Send the token as `Authorization: Bearer <token>`. Scripts may instead send `x-api-key` (create a tenant with `POST /api/tenants` + header `x-admin-secret`).

## 8. Project layout
```
.env / .env.example            <- root settings for Docker
docker-compose.yml             <- Option A (local DBs)
docker-compose.cloud.yml       <- Option B (your Atlas + Redis)
server/.env(.example)          <- settings when running without Docker
server/src/db.js               <- THE database connection file (aditydb)
server/src/auth.js authRoutes.js   passwords, tokens, validation, register/login/logout
server/src/engine              dag.js  saga.js  sandbox.js  runners.js
server/src                     routes.js worker.js sockets.js changeStreams.js quota.js queue.js middleware.js models.js
server/scripts/show-db.js      <- npm run db:show
client/.env(.example)          <- VITE_API_URL
client/src/pages               Login Builder Workflows Executions Dlq Dashboard
client/src/components          nodes.jsx NodeConfig.jsx
client/src/authValidate.js     form validation for login / sign-up
client/src/styles.css          all styling
scripts/smoke.mjs   loadtest/k6.js   docs/failure-recovery.md
```

## 9. Load test (1,000+ concurrent pipelines)
Set `RATE_LIMIT_PER_MIN=1000000` in `.env`, restart, create a tenant with a big quota via `POST /api/tenants` (admin secret), then:
`k6 run -e API=http://localhost:4000 -e KEY=<api key> -e WF=<workflow id> loadtest/k6.js`

## 10. Deploy to AWS (inside the $200 credit)
1. AWS Budgets alert first: https://console.aws.amazon.com/billing/home#/budgets
2. Use Atlas + Redis Cloud links (Option B values) as ECS environment variables / Secrets Manager. Set a strong `JWT_SECRET` and `ADMIN_SECRET`.
3. ECR: push `server` and `client` images. ECS Fargate: service `api` (ALB, port 4000, health `/health`) and service `worker` (command `node src/worker.js`, autoscale on CPU 60%).
4. Build the client with `VITE_API_URL=https://<your-alb-or-domain>`; host it on S3+CloudFront or run the client image.
5. Set `CORS_ORIGIN` to your frontend URL, `ENABLE_DEBUG_ROUTES=false`, and `ALLOW_SIGNUP=false` if only invited people should use it.
6. Delete NAT gateways / unused load balancers when not demoing.

## 11. Troubleshooting
- Login says "Cannot reach the API": the API container is not up yet (wait), or `VITE_API_URL` is wrong.
- "Invalid email or password": check the email/password; after 10 wrong tries wait 15 minutes.
- "Your session expired": tokens last `JWT_TTL_HOURS`; also happens if you change `JWT_SECRET`. Just sign in again.
- API restarts with Mongo errors on first start: normal for ~20s while the replica set elects a primary (`restart: on-failure` handles it).
- Atlas: "bad auth" -> wrong password (URL-encode special characters); timeout -> add your IP in Network Access.
- Port in use (27017 / 6379 / 4000 / 8080): stop the other program or change the left number in the compose file.
- Change Streams error: your MongoDB is not a replica set (Atlas is; plain local `mongod` is not).
- Data from the old version lived in a database called `workflow`; this version uses `aditydb`, so you start clean (old accounts used API keys, which still work for scripts).
