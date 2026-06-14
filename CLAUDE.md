# CLAUDE.md — Project Guide for Claude Code

This file is read automatically at the start of every session. It tells Claude Code what this project is, how it is structured, and how to work in it correctly.

---

## Project Overview

**Name:** CDAGS AI-Agents — OT-IT Convergence & Cybersecurity
**Pattern:** Mixture of Experts (MoE) AI-Agent Framework
**Purpose:** Orchestrate specialized Expert AI Agents and Sub-Agents for OT (Operational Technology) plant operations — asset management, security incident response, data monitoring, analytics, and more.

**Full specification:** `SPEC.md`
**Iteration 3 workbook:** `WORKBOOK-Iteration-3.md`
**Iteration 3b workbook:** `WORKBOOK-3b.md`

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
    api/                    # FastAPI route controllers
      auth.py               # login + require_jwt() + pwd_context
      users.py              # /api/users/ CRUD + EA access (superuser-gated)
      agents.py             # /api/agents/ (JWT enforced)
      logs.py               # /api/logs/ (JWT enforced)
  seed.py                   # Idempotent DB seed — safe to re-run
  requirements.txt
frontend/                   # React + TypeScript SPA
  src/
    App.tsx                 # Root component + hash-based dual-app router
    context/                # AuthContext, AgentContext, ThemeContext
    components/
      Layout/               # Banner, Sidebar, LogPanel, Footer
      Agent/                # AgentGrid, AgentTile
      Auth/                 # LoginForm
    admin/
      AdminApp.tsx          # AdminShell — viewMode + activeView state
      hooks/
        useAdminAgents.ts   # Agent management hook + logAdminAction()
        useUserMgmt.ts      # User CRUD hook + EA access + logAdminAction()
      components/
        AdminBanner.tsx     # Grid/Tile toggle (disabled for non-grid views)
        AdminNav.tsx        # Left nav — 4 views
        views/
          UserMgmtView.tsx  # Full user management UI
          AgentMgmtView.tsx # Agent activate/deactivate
          HealthStatusView.tsx
          PromptWindowView.tsx
    styles/                 # Vanilla CSS (variables, layouts, components)
    types/index.ts          # ALL shared TypeScript interfaces + constants
  vite.config.ts            # Port 6173, proxy /api → :8000
SPEC.md                     # Full technical specification (source of truth)
CLAUDE.md                   # This file
WORKBOOK-Iteration-3.md     # Step-by-step tutorial for Iteration 3
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
- **Auth dependency chain:** `require_jwt()` validates JWT and returns payload. `require_superuser()` wraps it and adds a 403 check for role. Both live in `app/api/auth.py` and `app/api/users.py` respectively.
- **SQLite migration pattern:** `ALTER TABLE ADD COLUMN` (no UNIQUE) + separate `CREATE UNIQUE INDEX` — used for `code_name`, `uid`. Always check `PRAGMA table_info` / `PRAGMA index_list` first.
- **Idempotent seed:** All seed inserts use `_get_or_create()`. The seed log entry is only written once (existence check before insert).
- **`uid`:** 8-char UUID hex generated at creation (`uuid.uuid4().hex[:8]`). Immutable after creation. Never set by the frontend.

### Frontend
- **All types** live in `src/types/index.ts` — do not scatter interfaces across component files.
- **Context pattern:** One context per concern — `AuthContext`, `AgentContext`, `ThemeContext`. Do not combine them.
- **CSS:** Themes live exclusively in `src/styles/variables.css` under `body.light-theme` / `body.dark-theme`.
- **`vite-env.d.ts`** must exist in `src/` for CSS/asset imports to type-check correctly.
- **Neon blue `#00f0ff`** is used for key heading highlights ("CDAGS" in banner).
- **Role short codes:** CHANGE (not CHG), REPORTS (not RPT), GENERAL (not GEN).
- **Read-only form fields** (Date Created, System UID) use `background: #1a1f2e`, `border: 1px solid transparent`, `color: var(--text-tertiary)` to visually distinguish from editable inputs.
- **Grid/Tile toggle** is disabled (opacity 0.35, `cursor: not-allowed`) when `activeView` is `user-mgmt` or `prompt-window`.
- **`logAdminAction()`** lives in both `useAdminAgents.ts` and `useUserMgmt.ts`. It is best-effort — swallows errors so the UI is never blocked.
- **`useUserMgmt.ts`:** `getEaAccess()` returns data directly (not stored in hook state). It is called on-demand when a row is selected, and cleared immediately on row switch.

### Git
- Do not commit: `appsFrame/` (venv), `backend/app/__pycache__/`, `backend/cdags_framework.db`, `frontend/node_modules/`.
- Commit `frontend/` and `backend/` source files together in logical units.
- Always run `npx tsc --noEmit` in `frontend/` before committing TypeScript changes.

---

## Current State (as of 2026-06-13)

### Iteration 3b — COMPLETE (User Management Polish)

- **RBAC:** 10 defined roles (see `VALID_ROLES` in `backend/app/schemas/user.py` and `UserRole` type in `frontend/src/types/index.ts`)
- **Backend:** `/api/users/` — 10 endpoints, all superuser-gated via `require_superuser()`
  - Includes `POST /export` (Excel download) and `POST /iam-lookup` (LDAP directory)
  - `DELETE` rejects self-delete and last-superuser-delete (HTTP 400)
- **User model:** `is_active`, `corporate_id`, `uid`, `full_name` columns — all via seed.py migrations
- **`UserEaAccess` join table:** controls which Expert Agents a `general-user` can access
- **Frontend hook:** `useUserMgmt.ts` — full CRUD + EA access + exportUsers + iamLookup + logAdminAction
- **`UserMgmtView.tsx`:** all 10 UX improvements implemented (see WORKBOOK-3b.md)
- **`mike.k`** seeded as first superuser (password: `Admin1234!`)
- TypeScript: zero errors (`tsc --noEmit` passes)

### Key conventions added in Iteration 3b
- **`isDirty` guard:** form tracks unsaved state; row switch / clear prompts if dirty
- **Password reset confirm:** typing in "Reset Password" field + Update → explicit `window.confirm()` before reset is sent
- **Role dots are display-only:** role changes go through the form's Role `<select>` + Update only
- **Toast types:** `showInfo()` (dark, 4s) vs `showError()` (red-tinted, 7s)
- **EA busy lock:** `eaBusy` flag + opacity fade prevents double-click races on EA toggle
- **Export flow:** fetch blob → `URL.createObjectURL` → hidden `<a>` click → revoke — no server-side file storage
- **Search scope:** covers `username`, `full_name`, and `email` (not just username)

### What is NOT done (known gaps going into Iteration 4)
1. **`PATCH /api/agents/{id}`** — backend toggle not implemented; UI shows "not yet implemented" toast
2. **`PromptWindowView`** — placeholder only
3. **`app/services/`** — agent engine / orchestrator / CAG-SAG routing not implemented
4. **`POST /api/orchestrate`** — orchestrator endpoint not implemented
5. **No test suite** — no Pytest tests in `backend/tests/`
6. **Role-based `/#app`** — non-admin users have no dedicated app shell yet
7. **Export email delivery** — Export downloads locally; Stalwart email integration deferred to future iteration

---

## Iteration 4 Plan — Orchestrator & Agent Engine

The next development phase implements the MoE execution layer and wires the remaining admin UI actions. See `SPEC.md` Section 5 for full detail.

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

### Key files to fix/extend
| File | Fix needed |
|------|-----------|
| `backend/app/api/agents.py` | Add `PATCH /{id}` endpoint to toggle `is_active` |
| `frontend/src/admin/components/views/AgentMgmtView.tsx` | Wire Activate/Deactivate to `PATCH /api/agents/{id}` |
| `frontend/src/admin/components/views/PromptWindowView.tsx` | Implement prompt/chat UI |
