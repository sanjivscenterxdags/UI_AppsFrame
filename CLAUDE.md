# CLAUDE.md — Project Guide for Claude Code

This file is read automatically at the start of every session. It tells Claude Code what this project is, how it is structured, and how to work in it correctly.

---

## Project Overview

**Name:** CDAGS AI-Agents — OT-IT Convergence & Cybersecurity  
**Pattern:** Mixture of Experts (MoE) AI-Agent Framework  
**Purpose:** Orchestrate specialized Expert AI Agents and Sub-Agents for OT (Operational Technology) plant operations — asset management, security incident response, data monitoring, analytics, and more.

**Full specification:** `SPEC.md`  
**Frontend reference:** `frontend/FRONTEND_ARCHITECTURE.md`  
**Backend architecture:** `backend/BACKEND_ARCHITECTURE.md`

---

## Repository Layout

```
appsFrame/                  # Python virtual environment (DO NOT commit)
backend/                    # FastAPI Python backend
  app/
    main.py                 # App entry, CORS, lifespan
    database.py             # SQLAlchemy engine + get_db()
    models/                 # SQLAlchemy ORM models
    schemas/                # Pydantic request/response schemas
    api/                    # FastAPI route controllers
  seed.py                   # DB seed script (run once: python seed.py)
  requirements.txt
frontend/                   # React + TypeScript SPA
  src/
    App.tsx                 # Root component + auth gate
    context/                # AuthContext, AgentContext, ThemeContext
    components/
      Layout/               # Banner, Sidebar, LogPanel, Footer
      Agent/                # AgentGrid, AgentTile
      Auth/                 # LoginForm
    styles/                 # Vanilla CSS (variables, layouts, components)
    types/index.ts          # Shared TypeScript interfaces
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

### Seed the database (first time or after reset)
```bash
cd backend
source ../appsFrame/bin/activate
python seed.py
```

### Frontend
```bash
cd frontend
npm install        # first time only
npm run dev        # starts on http://localhost:6173
```

Default login: `admin` / `admin`

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
- **Schema field names:** `ExpertAgentResponse` exposes sub-agents as `specific_sub_agents` (not `sag_sub_agents`). `SystemLogResponse` uses `created_at` (not `timestamp`).
- **`SubAgent` model:** Does NOT have a `code_name` column in the DB (omission to fix in Iteration 2).
- **JWT:** `JWT_SECRET_KEY` must be set in `backend/app/.env`. Generate with `openssl rand -hex 32`.
- **Auth gap:** JWT is issued on login but NOT yet validated on `GET /api/agents/` or `GET /api/logs/`. Those endpoints are currently unauthenticated.

### Frontend
- **All types** live in `src/types/index.ts` — do not scatter interfaces across component files.
- **Context pattern:** One context per concern — `AuthContext`, `AgentContext`, `ThemeContext`. Do not combine them.
- **CSS:** Themes live exclusively in `src/styles/variables.css` under `body.light-theme` / `body.dark-theme`. No separate themes file.
- **Import paths:** Components are one level deeper than before (`components/Layout/`, `components/Agent/`, `components/Auth/`) — context/types imports require `../../`.
- **`vite-env.d.ts`** must exist in `src/` for CSS/asset imports to type-check correctly.
- **Neon blue `#00f0ff`** is used for key heading highlights ("CDAGS" in banner, "AI-Agents" in main heading).

### Git
- Do not commit: `appsFrame/` (venv), `backend/app/__pycache__/`, `backend/cdags_framework.db`, `frontend/node_modules/`.
- Commit `frontend/` and `backend/` source files together in logical units.
- Always run `npx tsc --noEmit` in `frontend/` before committing TypeScript changes.

---

## Current State (as of 2026-06-12)

### What is complete (Iteration 1)
- Full React SPA: login, dashboard, agent grid, sidebar, log panel, light/dark theme
- FastAPI backend: auth (real JWT), agents, logs endpoints
- SQLAlchemy models: User, ExpertAgent, SubAgent, AgentInteraction, SystemLog
- 8 Expert Agents seeded in DB with per-agent color themes
- TypeScript: zero errors (`tsc --noEmit` passes)

### What is NOT done (known gaps going into Iteration 2)
1. **`seed.py` is destructive** — calls `drop_all()`, not idempotent
2. **Sub-agents not seeded** — 5 sub-agents (3 CAG, 2 SAG) and their mappings are missing from DB
3. **`SubAgent` model missing `code_name` column** — needed for agent engine dispatch
4. **No `services/agent_engine.py`** — CAG/SAG routing logic not implemented
5. **No orchestrator** — no `POST /api/orchestrate` endpoint; agents can't be dispatched
6. **JWT not enforced** on agent/log endpoints
7. **Frontend doesn't send `Authorization` header** on API calls
8. **No test suite** — no Pytest tests in `backend/tests/`

---

## Iteration 2 Plan — Orchestrator & Agent Engine

The next development phase implements the MoE execution layer. See `SPEC.md` Section 5 for full detail.

### Files to create
| File | Purpose |
|------|---------|
| `backend/app/services/__init__.py` | Package init |
| `backend/app/services/agent_engine.py` | `get_available_sub_agents()`, `dispatch()` |
| `backend/app/services/orchestrator.py` | Expert Agent selection / routing logic |
| `backend/app/api/orchestrator.py` | `POST /api/orchestrate` endpoint |
| `backend/tests/__init__.py` | Test package |
| `backend/tests/test_auth.py` | Auth endpoint tests |
| `backend/tests/test_agents.py` | Agent + orchestrate endpoint tests |

### Files to fix
| File | Fix needed |
|------|-----------|
| `backend/seed.py` | Make idempotent; add 5 sub-agents and SAG mappings |
| `backend/app/models/agent.py` | Add `code_name` column to `SubAgent` |
| `backend/app/api/agents.py` | Add JWT auth dependency |
| `backend/app/api/logs.py` | Add JWT auth dependency |
| `frontend/src/context/AuthContext.tsx` | Attach `Authorization: Bearer` header on all API calls |
| `frontend/src/context/AgentContext.tsx` | Pass auth header on agent/log fetches |
