# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

dockn is a personal productivity workspace: tasks, daily logs (rich-text journal), notes (notebooks → notes, TipTap editor), Excalidraw whiteboards, a dashboard, tags, and an activity feed. Rust/Axum API backend + React/Vite frontend, backed by Postgres.

## Commands

### Backend (`backend/`)

```bash
cargo run                 # start dev server on :8080; runs pending migrations automatically on boot
cargo build --release     # production build
cargo test                # run tests (e.g. auth_service.rs has unit tests)
cargo test <name>         # run a single test by name
```

sqlx uses **compile-time checked queries** (`sqlx::query!`/`query_as!`). Building requires either:
- a live `DATABASE_URL` Postgres connection, or
- `SQLX_OFFLINE=true` with the committed `backend/.sqlx/` query cache (this is what Docker/Railway builds use).

If you add or change a `sqlx::query!` call, regenerate the offline cache before committing:
```bash
cd backend
cargo sqlx prepare
```

Migrations live in `backend/migrations/` as sequential numbered `.sql` files (currently 0001–0013). Add new ones with `sqlx migrate add <name>`; they run automatically against `DATABASE_URL` on backend startup (`db::run_migrations` in `main.rs`) — there's no separate manual migration step in normal dev flow beyond the initial `sqlx migrate run` for a fresh DB (see README).

### Frontend (`frontend/`)

```bash
npm run dev          # Vite dev server on :3000, proxies /api to localhost:8080
npm run build         # tsc -b && vite build
npm run lint          # eslint, zero warnings allowed
npm run test          # vitest
npx tsc --noEmit      # type-check only, no build output
```

## Architecture

### Backend — layered Axum service

- `main.rs` builds a single `Router` from `routes::router()`, wraps it in CORS, compression, tracing, and a custom security-headers layer, then serves with `AppState { pool, config }` shared via `Arc`.
- `routes/` — one module per resource (`tasks`, `notes`, `notebooks`, `daily_logs`, `tags`, `whiteboards`, `whiteboard_folders`, `activity`, `search`, `capture`, `auth`, `health`). Each exposes a `router() -> Router<Arc<AppState>>`, nested under `/api/<resource>` in `routes/mod.rs`. `health` is nested at `/health` (used by the Railway healthcheck).
- `models/` — one struct file per domain entity, matching the migrations (`user`, `task`, `daily_log`, `notebook`, `note`, `tag`, `whiteboard`, `activity`).
- `services/` — cross-cutting business logic pulled out of route handlers: `auth_service` (password hashing, JWT issuing/verification) and `activity_service` (writes to the activity feed whenever another resource is created/updated — this is how the dashboard's "live activity feed" is populated, so new mutating endpoints that should show up there need to call it explicitly).
- `middleware/auth.rs` — `AuthUser` is an Axum extractor (`FromRequestParts`) that reads the `access_token` httpOnly cookie, verifies the JWT (secret from `JWT_SECRET` env var, read directly rather than via `AppState`), and injects the authenticated user into any handler that takes `AuthUser` as an argument. This is the standard way routes enforce auth — no separate auth middleware layer.
- `middleware/rate_limit.rs` currently only defines rate constants (`AUTH_RATE_PER_MINUTE`, `API_RATE_PER_MINUTE`); per-route enforcement via `governor` is applied where needed in route setup rather than globally.
- `error.rs` — a single `AppError` enum (`thiserror`) implements `IntoResponse` for the whole app; handlers return `AppResult<T> = Result<T, AppError>`. Postgres unique-violation (`23505`) is special-cased into a 409 Conflict automatically — don't duplicate that check in handlers.
- Auth model: Argon2id password hashes, short-lived JWT access token in an httpOnly cookie, rotating refresh token (see `0002_create_refresh_tokens.sql`) for silent re-auth.

### Frontend — React SPA

- Routing in `App.tsx` (`react-router-dom`), with `AuthGuard`/`GuestGuard` wrappers per route and a shared `AppLayout` for authenticated pages. Unmatched routes redirect to `/`.
- `api/client.ts` is the single fetch wrapper for all backend calls: it always sends `credentials: 'include'`, and on a 401 it transparently calls `/api/auth/refresh` once (de-duplicating concurrent refreshes) before retrying the original request — if refresh fails, it throws and `AuthContext` treats the user as logged out. Resource APIs (`tasksApi`, `notesApi`, etc.) are thin typed wrappers around this — follow the existing pattern when adding a new resource rather than calling `fetch` directly from components.
- `AuthContext` holds the current `user` and exposes `login`/`register`/`logout`/`refresh`; it's the source of truth `AuthGuard`/`GuestGuard` read from.
- Server state (tasks, notes, etc.) goes through TanStack Query; local/UI-only state (e.g. `store/uiStore.ts`) goes through Zustand — don't mix the two for the same piece of state.
- Notes use TipTap with JSONB content persisted to Postgres; Whiteboards use `@excalidraw/excalidraw`.
- Path alias `@/*` → `frontend/src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

### Chat feature runs outside the Rust backend

`frontend/api/chat.ts` is a **Vercel Edge Function** (not part of the Axum API) that proxies to OpenRouter via the `ai` SDK (`streamText`/`convertToModelMessages`), keyed by `OPENROUTER_API_KEY`. It's deployed alongside the static frontend on Vercel, separate from the Railway-hosted Rust backend. The `/chat` page (`pages/Chat.tsx`) talks to this function, not to `/api/*` on the Rust backend.

## Deployment topology

- **Backend + Postgres** → Railway, driven by `railway.toml` + `backend/Dockerfile` (multi-stage build, `SQLX_OFFLINE=true`, healthcheck on `/health`).
- **Frontend** → Vercel, driven by `frontend/vercel.json` (SPA rewrite to `index.html`, immutable caching for `/assets/*`); root directory must be set to `frontend`.
- CORS on the backend is locked to a single `FRONTEND_URL` origin with credentials allowed — both frontend and backend URLs must be kept in sync across the two platforms (see README's env var reference table).
