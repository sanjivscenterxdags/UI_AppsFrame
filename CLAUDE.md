# CLAUDE.md — Project Guide for Claude Code

This file is read automatically at the start of every session. It tells Claude Code what this project is, how it is structured, and how to work in it correctly.

---

## Project Overview

**Name:** CDAGS AI-Agents — OT-IT Convergence & Cybersecurity
**Pattern:** Mixture of Experts (MoE) AI-Agent Framework
**Purpose:** Orchestrate specialized Expert AI Agents and Sub-Agents for OT (Operational Technology) plant operations — asset management, security incident response, data monitoring, analytics, and more.

**Full specification:** `SPEC.md`
**Backend architecture notes:** `backend/BACKEND_ARCHITECTURE.md`

---

## Repository Layout

```
appsFrame/                  # Python virtual environment (DO NOT commit)
backend/                    # FastAPI Python backend
  app/
    main.py                 # App entry, CORS, lifespan, router registration
    database.py             # SQLAlchemy engine + get_db()
    models/                 # SQLAlchemy ORM models
      user.py               # User + UserEaAccess models
      agent.py              # ExpertAgent, SubAgent, AgentInteraction, mapping table
      log.py                # SystemLog model
    schemas/                # Pydantic request/response schemas
      user.py               # VALID_ROLES + all user management schemas
      agent.py              # Agent schemas
      log.py                # Log schemas
    api/                    # FastAPI route controllers
      auth.py               # login + require_jwt() + require_superuser()
      users.py              # /api/users/ CRUD + EA access + export + iam-lookup
      agents.py             # /api/agents/ (JWT enforced)
      logs.py               # /api/logs/ (JWT enforced)
  seed.py                   # Idempotent DB seed + schema migrations — safe to re-run
  requirements.txt
frontend/                   # React + TypeScript SPA
  src/
    App.tsx                 # Root component + hash-based dual-app router
    types/index.ts          # ALL shared TypeScript interfaces + constants
    context/                # AuthContext, AgentContext, ThemeContext
    components/
      Layout/               # Banner, Sidebar, LogPanel, Footer
      Agent/                # AgentGrid, AgentTile
      Auth/                 # LoginForm
    admin/
      AdminApp.tsx          # AdminShell — viewMode + activeView state
      hooks/
        useAdminAgents.ts   # Agent management hook + logAdminAction()
        useUserMgmt.ts      # User CRUD + EA access + exportUsers() + iamLookup()
      components/
        AdminBanner.tsx     # Grid/Tile toggle (disabled for non-grid views)
        AdminNav.tsx        # Left nav — 4 views
        views/
          UserMgmtView.tsx  # Full user management UI (Iteration 3 + 3b)
          AgentMgmtView.tsx # Agent activate/deactivate
          HealthStatusView.tsx
          PromptWindowView.tsx
    styles/                 # Vanilla CSS (variables, layouts, components)
  vite.config.ts            # Port 6173, proxy /api → :8000
SPEC.md                     # Full technical specification (source of truth)
CLAUDE.md                   # This file
```

---

## Running the Project

### Backend
```bash
cd backend
source ../appsFrame/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Seed the database (first time or after reset — safe to re-run)
```bash
cd backend
source ../appsFrame/bin/activate
python seed.py
```

### Frontend
```bash
cd frontend
npm install        # first time only
npm run dev        # http://localhost:6173
```

### TypeScript check (run before every commit)
```bash
cd frontend
npx tsc --noEmit
```

### Logins

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | admin (legacy) |
| `mike.k` | `Admin1234!` | superuser |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, SQLAlchemy 2.x, SQLite |
| Auth | passlib/bcrypt, python-jose HS256 JWT |
| Frontend | React 19, TypeScript, Vite 8, Vanilla CSS |
| Styling | CSS custom properties (no Tailwind, no CSS-in-JS) |

---

## Key Conventions

### Backend

- **SQLAlchemy 2.x:** Use `DeclarativeBase` from `sqlalchemy.orm` — never the legacy `declarative_base()`.
- **Timestamps:** Always use `lambda: datetime.now(timezone.utc)` — never `datetime.utcnow()`.
- **Schema field names:** `ExpertAgentResponse` exposes sub-agents as `specific_sub_agents`. `SystemLogResponse` uses `created_at` (not `timestamp`).
- **JWT:** `JWT_SECRET_KEY` must be set in `backend/app/.env`. Generate with `openssl rand -hex 32`.
- **Auth dependency chain:** `require_jwt()` validates JWT and returns payload. `require_superuser()` wraps it and adds a 403 check for role. Both live in `app/api/auth.py`.
- **SQLite migration pattern:** `ALTER TABLE ADD COLUMN` (no UNIQUE inline) + separate `CREATE UNIQUE INDEX IF NOT EXISTS` — used for `code_name`, `uid`. Always check `PRAGMA table_info` / `PRAGMA index_list` first to guard migrations.
- **Idempotent seed:** All seed inserts use `_get_or_create()`. The seed log entry is only written once (existence check before insert). `seed.py` never calls `drop_all()`.
- **`uid`:** 8-char UUID hex generated at user creation (`uuid.uuid4().hex[:8]`). Immutable after creation. Never set by the frontend.
- **Delete guards:** `DELETE /api/users/{id}` rejects self-delete (HTTP 400) and last-superuser-delete (HTTP 400) — checked in the endpoint before ORM delete.

### Frontend

- **All types** live in `src/types/index.ts` — do not scatter interfaces across component files.
- **Context pattern:** One context per concern — `AuthContext`, `AgentContext`, `ThemeContext`. Do not combine them.
- **CSS:** Themes live exclusively in `src/styles/variables.css` under `body.light-theme` / `body.dark-theme`.
- **`vite-env.d.ts`** must exist in `src/` for CSS/asset imports to type-check correctly.
- **Neon blue `#00f0ff`** is used for key heading highlights ("CDAGS" in both banners).
- **Role short codes:** CHANGE (not CHG), REPORTS (not RPT), GENERAL (not GEN).
- **Read-only form fields** (Date Created, System UID) use `background: #1a1f2e`, `border: 1px solid transparent`, `color: var(--text-tertiary)` to visually distinguish from editable inputs.
- **Grid/Tile toggle** is disabled (opacity 0.35, `cursor: not-allowed`) when `activeView` is `user-mgmt` or `prompt-window`.
- **`logAdminAction()`** lives in both `useAdminAgents.ts` and `useUserMgmt.ts`. It is best-effort — swallows errors so the UI is never blocked by a failed audit log write.
- **`useUserMgmt.ts`:** `getEaAccess()` returns data directly (not stored in hook state). Called on-demand when a row is selected; cleared immediately on row switch.
- **Export flow:** `fetch` blob → `URL.createObjectURL` → hidden `<a>` click → `URL.revokeObjectURL` — no server-side file storage.
- **Search scope:** live filter covers `username`, `full_name`, and `email` — not just username.
- **`isDirty` guard:** form tracks unsaved state; row switch / Clear prompts "Discard and continue?" if dirty.
- **Password reset confirm:** typing in the Reset Password field + clicking Update triggers `window.confirm()` before the reset is sent to the backend.
- **Role dots are display-only:** role changes must go through the form's Role `<select>` + Update button — clicking dots does nothing (eliminates misclick risk).
- **Toast types:** `showInfo()` (dark bg, 4s auto-dismiss) vs `showError()` (red-tinted bg + border, 7s).
- **EA busy lock:** `eaBusy` flag + opacity fade on EA Access panel prevents double-click races during in-flight toggle requests.

### Git

- Do not commit: `appsFrame/` (venv), `backend/app/__pycache__/`, `backend/cdags_framework.db`, `frontend/node_modules/`.
- Commit `frontend/` and `backend/` source files together in logical units.
- Always run `npx tsc --noEmit` in `frontend/` before committing TypeScript changes.

---

## Current State (as of 2026-06-14)

### Iteration 3b — COMPLETE (User Management Polish)

- **RBAC:** 10 defined roles (see `VALID_ROLES` in `backend/app/schemas/user.py` and `UserRole` in `frontend/src/types/index.ts`)
- **User model columns:** `is_active`, `corporate_id`, `uid`, `full_name` — all added via `seed.py` migrations
- **`UserEaAccess` join table:** controls which Expert Agents a `general-user` can access
- **Backend `/api/users/`:** 10 endpoints, all superuser-gated via `require_superuser()`
  - `POST /export` — openpyxl Excel download via `StreamingResponse`
  - `POST /iam-lookup` — LDAP query for `corporate_id` + `full_name`; returns 503 if `IAM_*` env vars are absent
  - `DELETE /{id}` — rejects self-delete and last-superuser-delete (HTTP 400)
- **Frontend hook `useUserMgmt.ts`:** full CRUD + EA access + `exportUsers()` + `iamLookup()` + `logAdminAction()`
- **`UserMgmtView.tsx`:** 3-section layout — Add/Edit form, search/filter/table, EA Access panel
- **`mike.k`** seeded as first superuser (`Admin1234!`)
- TypeScript: zero errors (`tsc --noEmit` passes)

### Known gaps going into Iteration 4

1. **`PATCH /api/agents/{id}`** — backend toggle not implemented; UI shows "Toggle not yet implemented" toast
2. **`PromptWindowView`** — placeholder only; no chat UI
3. **`app/services/`** — agent engine / orchestrator / CAG-SAG routing not implemented
4. **`POST /api/orchestrate`** — orchestrator endpoint not implemented
5. **No test suite** — no Pytest tests in `backend/tests/`
6. **Role-based `/#app`** — non-admin users have no dedicated app shell yet
7. **Export email delivery** — Export downloads locally; email integration deferred

---

## Iteration 4 Plan — Orchestrator & Agent Engine

The next phase implements the MoE execution layer and wires remaining admin UI actions. See `SPEC.md` Section 5 for the full task list.

### Key files to create

| File | Purpose |
|------|---------|
| `backend/app/services/__init__.py` | Package init |
| `backend/app/services/agent_engine.py` | `get_available_sub_agents()`, `dispatch()` |
| `backend/app/services/orchestrator.py` | Expert Agent selection / routing logic |
| `backend/app/api/orchestrator.py` | `POST /api/orchestrate` endpoint |
| `backend/tests/__init__.py` | Test package |
| `backend/tests/test_auth.py` | Auth endpoint tests |
| `backend/tests/test_agents.py` | Agent + orchestrate endpoint tests |

### Key files to extend

| File | Change needed |
|------|--------------|
| `backend/app/api/agents.py` | Add `PATCH /{id}` to toggle `is_active` on ExpertAgent |
| `frontend/src/admin/components/views/AgentMgmtView.tsx` | Wire Activate/Deactivate to `PATCH /api/agents/{id}` |
| `frontend/src/admin/components/views/PromptWindowView.tsx` | Implement prompt/chat UI wired to `POST /api/orchestrate` |
