# ProcureFlow — B2B purchase request approvals

Small full-stack **B2B** demo: organizations, role-based access (**admin** / **approver** / **member**), **draft → pending → approved|rejected** purchase requests, and a React dashboard.

## Stack

- **Backend:** Node.js, Express, TypeScript, SQLite (`better-sqlite3`), Zod, JWT, bcrypt
- **Frontend:** Vite, React 18, TypeScript, TanStack Query, React Router, Tailwind CSS

## Prerequisites

- Node.js **20+** recommended (18 may work; use 20 for parity with current tooling)
- npm

## Setup

```bash
cd b2b-platform
npm install
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_SECRET to a long random string (16+ chars)
```

## Run locally

**Terminal A — API (port 4000)**

```bash
cd b2b-platform/backend
npm run dev
```

**Terminal B — Web (port 5173, proxies `/api` to 4000)**

```bash
cd b2b-platform/frontend
npm run dev
```

Open `http://localhost:5173`. Register two users to try approvals: one **admin** (creates org), add the other as **member** or **approver**, then create / submit / approve requests.

## Production build

```bash
cd b2b-platform
npm run build
```

This compiles the API to `backend/dist/` and the UI to `frontend/dist/`.

## How to deploy

You have two common layouts: **one server** (simplest) or **split** (static CDN + API).

### A. One server (API + SPA together)

Good for a **VPS** (DigitalOcean, Lightsail, EC2), **Railway**, **Render**, etc. The API serves the built React app from the same port (same origin — no CORS changes needed).

#### On your machine (smoke test)

From the **repository root** (`b2b-platform/`):

```bash
cp backend/.env.example backend/.env
# Edit backend/.env: set JWT_SECRET (16+ chars). Keep STATIC_DIR=../frontend/dist
npm install
npm run start:prod
```

Open `http://localhost:4000` (or your `PORT`). You should see the UI; API remains under `/api/...`.

#### On a Linux VPS (typical)

1. **Install Node.js 20+** and clone this repo.
2. `cd b2b-platform && npm install`
3. `cp backend/.env.example backend/.env` and edit:
   - **`JWT_SECRET`** — long random string (16+ chars).
   - **`PORT`** — e.g. `8080` internally (or omit and use your host’s default).
   - **`DATABASE_PATH`** — absolute path on a **persistent** volume, e.g. `/var/lib/procureflow/data.sqlite` (create the directory; the app will create the file).
   - **`STATIC_DIR=../frontend/dist`** — paths are resolved from the `backend/` folder, so this stays valid when you start from the repo root.
4. **Build and run** (from repo root):
   ```bash
   npm run build
   npm run start
   ```
   (`npm run start` runs `node backend/dist/index.js` via the backend workspace; `STATIC_DIR` still resolves correctly.)
5. **Reverse proxy + HTTPS:** Put **Caddy** or **nginx** in front, proxy `https://your-domain` → `http://127.0.0.1:8080` (or your `PORT`). Use Let’s Encrypt for TLS.
6. **Process manager:** Use **systemd** or **PM2** so the Node process restarts on crash or reboot.

**SQLite:** Use a **disk/volume** that survives redeploys. Ephemeral containers without a mount will **lose the database** on restart.

### B. Split: static site + API

- Host **frontend** on **Netlify**, **Vercel**, **S3 + CloudFront**, etc. Build with `VITE_API_URL=https://api.your-domain.com` so the browser calls your API host (update `frontend` env at build time).
- Run the **API** on a VM or container URL as in (A), without `STATIC_DIR`.
- Set **`CORS_ORIGINS`** on the API to your real UI origin(s), e.g. `CORS_ORIGINS=https://app.your-domain.com`.

### Checklist

| Concern | What to do |
|--------|------------|
| Secrets | Never commit `.env`; set `JWT_SECRET` in the host environment. |
| CORS | Use `CORS_ORIGINS` when UI and API have different origins. |
| DB | Persist `DATABASE_PATH` or switch to Postgres for production. |
| HTTPS | Terminate TLS at the proxy or load balancer. |

## API sketch

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/register` | `{ email, password, name }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/me` | Bearer JWT |
| GET | `/api/orgs` | List orgs for user |
| POST | `/api/orgs` | Create org; caller becomes `admin` |
| GET | `/api/orgs/:orgId` | Org + members |
| POST | `/api/orgs/:orgId/members` | Admin: `{ email, role }` — user must exist |
| GET | `/api/organizations/:orgId/requests` | List requests |
| POST | `/api/organizations/:orgId/requests` | Create **draft** |
| POST | `/api/requests/:id/submit` | Requester: draft → pending |
| POST | `/api/requests/:id/approve` | Admin / approver |
| POST | `/api/requests/:id/reject` | Admin / approver; body `{ note }` |

## Next steps (portfolio / HENNGE-style)

- OIDC (e.g. Auth0 / Keycloak), Dockerfile + ECR/Fargate, Terraform for AWS, GitHub Actions CI, DynamoDB, structured logging, integration tests.
