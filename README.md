# dockn

A personal productivity workspace built to keep your development workflow in one place. Manage tasks, write daily logs, organise notes into notebooks, and sketch on whiteboards — all in a fast, self-contained app.

---

## What it does

| Feature | Description |
|---|---|
| **Tasks** | Create, prioritise (urgent/high/medium/low), and track tasks with due dates, descriptions, tags, and status (todo / in progress / done / cancelled) |
| **Daily Logs** | Rich-text journal entries per day with a mood score and auto-save — good for end-of-day standups or retrospectives |
| **Notes** | Notebooks → Notes hierarchy. Each note uses a TipTap rich-text editor with JSONB content stored in Postgres |
| **Whiteboards** | Excalidraw-powered infinite canvas for diagrams, sketching, and brainstorming |
| **Dashboard** | At-a-glance stats: open tasks, overdue count, completion rate, and a live activity feed |
| **Tags** | Reusable colour-coded tags attachable to tasks |
| **Activity feed** | Every create/update action is logged and surfaced on the dashboard |

---

## Tech stack

**Backend** — Rust · Axum 0.7 · sqlx 0.7 · PostgreSQL  
**Frontend** — React 18 · Vite · TypeScript (strict) · TanStack Query v5 · Zustand · TipTap · Excalidraw · Tailwind CSS  
**Auth** — Argon2id password hashing · JWT access tokens (httpOnly cookies) · refresh token rotation  
**Deployment** — Railway (backend + Postgres) · Vercel (frontend)

---

## Project structure

```
dockn/
├── backend/
│   ├── src/
│   │   ├── main.rs
│   │   ├── db.rs
│   │   ├── error.rs
│   │   ├── middleware/        # JWT auth extractor, rate limiting
│   │   ├── models/            # Task, Note, DailyLog, Tag, …
│   │   ├── routes/            # Axum route handlers
│   │   └── services/          # activity_service, auth_service
│   ├── migrations/            # 13 sequential sqlx migrations
│   ├── Cargo.toml
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/               # Typed API client
│   │   ├── components/        # Shared UI components
│   │   ├── context/           # AuthContext
│   │   ├── pages/             # Dashboard, Tasks, Notes, Logs, Whiteboards
│   │   ├── store/             # Zustand stores
│   │   └── types/             # Shared TypeScript interfaces
│   ├── package.json
│   └── .env.example
├── railway.toml
├── vercel.json
└── .gitignore
```

---

## Local development

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (for local Postgres)

### 1. Start a local Postgres instance

```bash
docker run -d --name dockn-pg \
  -e POSTGRES_USER=dockn \
  -e POSTGRES_PASSWORD=dockn \
  -e POSTGRES_DB=dockn \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://dockn:dockn@localhost:5432/dockn
JWT_SECRET=<generate: openssl rand -hex 64>
REFRESH_TOKEN_SECRET=<generate: openssl rand -hex 64>
FRONTEND_URL=http://localhost:3000
RUST_LOG=debug
PORT=8080
```

```bash
cp frontend/.env.example frontend/.env
# VITE_API_URL=http://localhost:8080  (already correct)
```

### 3. Run migrations

```bash
cd backend
cargo install sqlx-cli --no-default-features --features postgres,rustls
sqlx migrate run --database-url "postgresql://dockn:dockn@localhost:5432/dockn"
```

### 4. Start the backend

```bash
cd backend
cargo run
# Listening on http://localhost:8080
# Migrations also run automatically on startup
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

### Quick API smoke test

```bash
# Register
curl -c cookies.txt -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Dev","last_name":"User","email":"dev@example.com","password":"Password1!"}'

# Create a task
curl -b cookies.txt -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Ship it","priority":"urgent","description":"Deploy to prod"}'

# List tasks (includes tags)
curl -b cookies.txt http://localhost:8080/api/tasks
```

### TypeScript type-check (no build needed)

```bash
cd frontend
npx tsc --noEmit
```

---

## Deployment

### Railway (backend + database)

1. Push to GitHub
2. New Project → Deploy from GitHub repo
3. Add a **PostgreSQL** service — `DATABASE_URL` is injected automatically
4. Set variables: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_URL`, `RUST_LOG=info`
5. Railway uses `railway.toml` + `backend/Dockerfile` automatically

### Vercel (frontend)

1. New Project → import same repo, set **Root Directory** to `frontend`
2. Add variable: `VITE_API_URL=https://<your-railway-domain>`
3. `vercel.json` handles the SPA catch-all rewrite

After both are live, update `FRONTEND_URL` on Railway to your Vercel URL to allow CORS.

---

## Environment variables reference

| Variable | Where | Set by |
|---|---|---|
| `DATABASE_URL` | Railway | Auto-injected by Postgres service |
| `JWT_SECRET` | Railway | You (64+ chars) |
| `REFRESH_TOKEN_SECRET` | Railway | You (64+ chars) |
| `FRONTEND_URL` | Railway | You (Vercel URL) |
| `RUST_LOG` | Railway | You (`info`) |
| `VITE_API_URL` | Vercel | You (Railway URL) |
