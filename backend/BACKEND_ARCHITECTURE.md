# CDAGS Backend Architecture
## Mixture of Experts (MOE) Design Pattern

**Version:** 1.0.0  
**Date:** June 2026  
**Framework:** FastAPI + SQLAlchemy + SQLite

---

## Table of Contents

1. [What is the Mixture of Experts Pattern?](#1-what-is-the-mixture-of-experts-pattern)
2. [System Overview](#2-system-overview)
3. [Agent Hierarchy Diagram](#3-agent-hierarchy-diagram)
4. [Layer-by-Layer Explanation](#4-layer-by-layer-explanation)
   - [Layer 0 — The User / Frontend Client](#layer-0--the-user--frontend-client)
   - [Layer 1 — The API Gateway (FastAPI)](#layer-1--the-api-gateway-fastapi)
   - [Layer 2 — The Orchestrator (Expert Agent)](#layer-2--the-orchestrator-expert-agent)
   - [Layer 3 — The Specialists (Sub-Agents)](#layer-3--the-specialists-sub-agents)
   - [Layer 4 — The Interaction Ledger](#layer-4--the-interaction-ledger)
   - [Layer 5 — The System Log](#layer-5--the-system-log)
5. [Database Schema](#5-database-schema)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Authentication Flow](#7-authentication-flow)
8. [Request Lifecycle — End to End](#8-request-lifecycle--end-to-end)
9. [Module Map](#9-module-map)
10. [Key Design Decisions](#10-key-design-decisions)

---

## 1. What is the Mixture of Experts Pattern?

The **Mixture of Experts (MOE)** pattern is an AI architecture where a single large problem is broken down and routed to a set of smaller, specialized models or agents — each an "expert" in a narrow domain. Rather than one generalist model handling everything, a **gating / orchestration layer** decides which expert is best suited for a given task and dispatches to it.

```
                        ┌─────────────────────┐
                        │   Incoming Request   │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   Orchestrator /     │
                        │   Expert Agent       │  ← decides which specialist to call
                        └──┬───┬───┬───┬──────┘
                           │   │   │   │
                    ┌──────┘   │   │   └──────┐
                    ▼          ▼   ▼           ▼
               Expert A   Expert B  Expert C  Expert D
                    │          │   │           │
                    ▼          ▼   ▼           ▼
              Sub-Agent   Sub-Agent Sub-Agent Sub-Agent
              (Specialist) (Specialist) ...
```

### Why MOE for CDAGS?

CDAGS manages an **OT (Operational Technology) plant environment** with highly distinct domains — asset management, risk, security incidents, analytics, and more. Each domain has its own data shape, rules, and vocabulary. A MOE architecture means:

- **Domain isolation** — each Expert Agent owns its domain; changes in one don't affect others.
- **Scalability** — new Expert Agents can be added without touching existing ones.
- **Specialization** — Sub-Agents within each Expert can be tuned or swapped independently.
- **Auditability** — every interaction is recorded in `agent_interactions`, giving a full trace of which expert handled what and why.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CDAGS BACKEND                            │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐ │
│  │  Client  │───▶│  FastAPI     │───▶│  Business Logic       │ │
│  │ (Browser │    │  API Gateway │    │  (Agents / Auth / Log)│ │
│  │  / curl) │    │  main.py     │    └──────────┬────────────┘ │
│  └──────────┘    └──────────────┘               │              │
│                                                  ▼              │
│                                    ┌─────────────────────────┐ │
│                                    │  SQLAlchemy ORM         │ │
│                                    │  database.py            │ │
│                                    └──────────┬──────────────┘ │
│                                               │                 │
│                                    ┌──────────▼──────────────┐ │
│                                    │  SQLite / PostgreSQL DB  │ │
│                                    │  cdags_framework.db      │ │
│                                    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Hierarchy Diagram

This is the core MOE hierarchy as implemented in the CDAGS backend.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        CDAGS MOE AGENT HIERARCHY                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

                           ┌──────────────────┐
                           │   USER / CLIENT   │
                           │  (Frontend App)   │
                           └────────┬─────────┘
                                    │  HTTP Request
                                    ▼
                    ┌───────────────────────────────┐
                    │      FastAPI API Gateway       │
                    │  POST /api/auth/login          │
                    │  GET  /api/agents/             │
                    │  POST /api/agents/{id}/select  │
                    │  GET  /api/logs/               │
                    └───────────────┬───────────────┘
                                    │  Authenticated + Routed
                                    ▼
         ╔══════════════════════════════════════════════════╗
         ║           EXPERT AGENT LAYER (Orchestrators)     ║
         ║      Each Expert owns one functional domain       ║
         ╠══════════╦══════════╦══════════╦══════════════════╣
         ║          ║          ║          ║                  ║
    ┌────▼────┐┌────▼────┐┌────▼────┐┌───▼──────┐  ... (8 total)
    │ UI Color││OT Plant ││OT Plant ││OT Plant  │
    │ Palette ││  Data   ││  Asset  ││  Risk    │
    │ Manager ││ Manager ││Register ││ Register │
    │#334155  ││#1e3a8a  ││#0f766e  ││#15803d   │
    └────┬────┘└────┬────┘└────┬────┘└───┬──────┘
         │          │          │         │
         │     ┌────▼────┐┌────▼────┐    │
         │     │OT Change││OT Log & │    │
         │     │  Mgmt   ││Monitor  │    │
         │     │ Manager ││ Manager │    │
         │     │#991b1b  ││#b45309  │    │
         │     └────┬────┘└────┬────┘    │
         │          │          │         │
         │     ┌────▼────┐┌────▼────┐    │
         │     │OT Sec.  ││OT Analy-│    │
         │     │Incident ││ tics &  │    │
         │     │ Manager ││ Report  │    │
         │     │#4338ca  ││#0369a1  │    │
         │     └─────────┘└─────────┘    │
         │                               │
         └──────────────┬────────────────┘
                        │  Many-to-Many via
                        │  expert_sub_agent_mapping
                        ▼
         ╔══════════════════════════════════════════════════╗
         ║            SUB-AGENT LAYER (Specialists)         ║
         ║  Reusable specialists shared across Expert Agents ║
         ╠══════════════╦═══════════════╦═══════════════════╣
         ║              ║               ║                   ║
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │  CAG    │    │  CAG    │    │  SAG    │    │  SAG    │
    │(Common  │    │(Common  │    │(Special-│    │(Special-│
    │Sub-Agent│    │Sub-Agent│    │ ized    │    │ ized    │
    │ Group)  │    │ Group)  │    │Sub-Agent│    │Sub-Agent│
    │ e.g.    │    │ e.g.    │    │ Group)  │    │ Group)  │
    │ Logger  │    │ Notifier│    │ e.g.    │    │ e.g.    │
    │         │    │         │    │ Risk    │    │ Incident│
    │         │    │         │    │ Analyst │    │ Handler │
    └────┬────┘    └─────────┘    └─────────┘    └─────────┘
         │
         ▼
    ╔═══════════════════════════════════╗
    ║      INTERACTION LEDGER           ║
    ║   agent_interactions table        ║
    ║  Records every Expert ↔ Sub-Agent ║
    ║  exchange with full metadata:     ║
    ║  - input_prompt                   ║
    ║  - output_response                ║
    ║  - duration_ms                    ║
    ║  - input_tokens / output_tokens   ║
    ╚═══════════════════════════════════╝
         │
         ▼
    ╔═══════════════════════════════════╗
    ║         SYSTEM LOG                ║
    ║      system_logs table            ║
    ║  Captures all system events:      ║
    ║  - Agent selections               ║
    ║  - Auth events                    ║
    ║  - Errors and warnings            ║
    ║  levels: DEBUG/INFO/WARNING/      ║
    ║          ERROR/SUCCESS            ║
    ╚═══════════════════════════════════╝
```

---

## 4. Layer-by-Layer Explanation

### Layer 0 — The User / Frontend Client

The frontend (a browser app, mobile client, or API consumer like `curl`) is the entry point. It communicates with the backend exclusively over HTTP using JSON payloads. The client:

1. **Authenticates** via `POST /api/auth/login` to receive a signed JWT token.
2. **Queries available Expert Agents** via `GET /api/agents/` to present a menu of domain experts.
3. **Selects an Expert Agent** via `POST /api/agents/{id}/select` to register which expert the user wants to work with.
4. **Reads system logs** via `GET /api/logs/` for monitoring and audit display.

The client never talks directly to the database or to individual Sub-Agents — all communication flows through the API Gateway.

---

### Layer 1 — The API Gateway (FastAPI)

**File:** `app/main.py`

FastAPI is the API Gateway — the single entry point that receives all HTTP requests, enforces authentication, validates request payloads, and routes calls to the correct handler.

```
app/main.py
    │
    ├── lifespan()         → runs create_all on startup; initialises DB tables
    ├── CORSMiddleware     → allows frontend on a different origin to call the API
    ├── /api/auth   ──────▶ app/api/auth.py
    ├── /api/agents ──────▶ app/api/agents.py
    └── /api/logs   ──────▶ app/api/logs.py
```

**Key design points:**

- **Lifespan handler** — `Base.metadata.create_all()` runs inside the `lifespan` async context manager, not at import time. This means table creation only happens when the server actually starts, not when the module is imported during testing or tooling.
- **Router prefixes** — each domain has its own router file with its own prefix (`/api/auth`, `/api/agents`, `/api/logs`). Adding a new domain means creating a new router file and one `include_router` line in `main.py` — no other file needs to change.
- **CORS** — currently open (`allow_origins=["*"]`) for development. Before production, restrict this to the specific frontend origin.

---

### Layer 2 — The Orchestrator (Expert Agent)

**Files:** `app/models/agent.py` → `ExpertAgent`, `app/api/agents.py`, `app/schemas/agent.py` → `ExpertAgentResponse`

The `ExpertAgent` is the **orchestrator node** in the MOE hierarchy. Each instance represents one functional domain in the OT plant environment.

#### The 8 Expert Agents (seeded in `seed.py`)

| # | Name | Code Name | Color |
|---|------|-----------|-------|
| 1 | UI Color Palette Manager | `ui_color_palate_manager` | `#334155` Slate Grey |
| 2 | OT Plant Data Manager | `ot_plant_data_manager` | `#1e3a8a` Navy Blue |
| 3 | OT Plant Asset Register Manager | `ot_plant_asset_register_manager` | `#0f766e` Deep Teal |
| 4 | OT Plant Asset Risk Register Manager | `ot_plant_asset_risk_register_manager` | `#15803d` Forest Green |
| 5 | OT Plant Change Management Manager | `ot_plant_change_management_manager` | `#991b1b` Deep Crimson |
| 6 | OT Plant Logging & Monitoring Manager | `ot_plant_logging_and_monitoring_manager` | `#b45309` Dark Amber |
| 7 | OT Plant Security Incident Manager | `ot_plant_security_incident_manager` | `#4338ca` Indigo |
| 8 | OT Plant Analytics & Report Manager | `ot_plant_analytics_and_report_manager` | `#0369a1` Steel Blue |

#### ExpertAgent Model Fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | Integer PK | Unique database identifier |
| `name` | String (unique) | Human-readable display name |
| `code_name` | String (unique) | Machine-readable slug for programmatic routing |
| `description` | Text | What domain this expert handles |
| `color_theme` | String | HEX colour for UI card rendering |
| `is_active` | Boolean | Soft-delete flag — inactive agents are hidden from the UI |
| `created_at` | DateTime | UTC timestamp of creation |
| `updated_at` | DateTime | UTC timestamp of last modification |
| `specific_sub_agents` | Relationship | Many-to-many link to its Sub-Agents |

#### Role in MOE

In the MOE pattern, the Expert Agent acts as the **gating function** for its domain. When the frontend selects an Expert Agent, it is telling the system: *"all subsequent tasks should be handled by this domain's specialists."* The Expert Agent then delegates to one or more of its Sub-Agents based on the nature of the task.

---

### Layer 3 — The Specialists (Sub-Agents)

**File:** `app/models/agent.py` → `SubAgent`

Sub-Agents are the **leaf nodes** of the MOE hierarchy — the actual specialists that execute tasks. They are connected to Expert Agents through a **many-to-many association table** (`expert_sub_agent_mapping`), allowing:

- One Expert Agent to have **multiple Sub-Agents** (a domain may need several specialists).
- One Sub-Agent to be **shared across multiple Expert Agents** (a common capability reused across domains).

#### Sub-Agent Types

Sub-Agents are classified by `group_type`:

| Type | Name | Description |
|------|------|-------------|
| `CAG` | Common Agent Group | Reusable, horizontal capabilities shared across all Expert Agents — e.g., a logging sub-agent, a notification sub-agent, a data-validation sub-agent. |
| `SAG` | Specialized Agent Group | Domain-specific specialists exclusive to one Expert Agent — e.g., a Risk Scoring sub-agent that only makes sense inside the Risk Register Expert. |

#### Many-to-Many Relationship

```
expert_agents          expert_sub_agent_mapping       sub_agents
─────────────          ────────────────────────       ──────────
id ◀────────────────── expert_agent_id               id
                        sub_agent_id ───────────────▶ id
```

The `expert_sub_agent_mapping` association table holds only two foreign key columns — `expert_agent_id` and `sub_agent_id` — both forming a composite primary key. Deleting either an Expert Agent or a Sub-Agent cascades and removes the mapping row automatically (`ondelete='CASCADE'`).

---

### Layer 4 — The Interaction Ledger

**File:** `app/models/agent.py` → `AgentInteraction`

Every time an Expert Agent delegates a task to a Sub-Agent, an `AgentInteraction` record is written. This is the **audit trail and analytics foundation** of the system.

```
AgentInteraction
├── expert_agent_id  → which orchestrator initiated the call
├── sub_agent_id     → which specialist handled it
├── input_prompt     → the task/question sent to the sub-agent
├── output_response  → the sub-agent's answer
├── duration_ms      → how long the sub-agent took to respond
├── input_tokens     → token count of the prompt (for LLM cost tracking)
├── output_tokens    → token count of the response (for LLM cost tracking)
└── created_at       → UTC timestamp of the interaction
```

**Why this matters:**

- **Observability** — you can replay every decision the system made.
- **Cost accounting** — `input_tokens` + `output_tokens` allow per-expert LLM cost attribution.
- **Performance tuning** — `duration_ms` identifies slow Sub-Agents that need optimisation.
- **Training data** — interaction history can be used to fine-tune future specialist models.

---

### Layer 5 — The System Log

**Files:** `app/models/log.py` → `SystemLog`, `app/api/logs.py`

The `SystemLog` table is the **operational event bus** — it captures everything that happens in the system that isn't a direct agent interaction: user actions, auth events, system errors, and administrative operations.

```
SystemLog
├── id            → unique entry identifier
├── created_at    → UTC timestamp
├── level         → DEBUG | INFO | WARNING | ERROR | SUCCESS
├── source        → who/what generated the event (e.g. "USER", "SYSTEM", "API")
├── message       → human-readable description of the event
└── metadata_json → optional structured context as a JSON string
                    e.g. {"agent_id": 3, "name": "OT Plant Data Manager"}
```

**Level meanings:**

| Level | Used when |
|-------|-----------|
| `DEBUG` | Verbose internal state for development troubleshooting |
| `INFO` | Normal operational events (agent selected, user logged in) |
| `WARNING` | Something unexpected but non-fatal (deprecated call, near-limit) |
| `ERROR` | Something failed that needs attention |
| `SUCCESS` | An operation completed with an explicitly positive outcome |

The `level` values are enforced both by a **Pydantic `Literal` type** in the schema and a **database `CheckConstraint`** in the model — so invalid levels are rejected at both the API and database layers.

---

## 5. Database Schema

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE TABLES                              │
├──────────────────┬──────────────────────────────────────────────────┤
│  users           │  expert_agents                                   │
│ ─────────────── │ ────────────────────────────────────────────────  │
│  id (PK)         │  id (PK)                                         │
│  username        │  name (unique)                                   │
│  email           │  code_name (unique)                              │
│  hashed_password │  description                                     │
│  role            │  color_theme                                     │
│  created_at      │  is_active                                       │
│  updated_at      │  created_at                                      │
│                  │  updated_at                                      │
├──────────────────┼──────────────────────────────────────────────────┤
│  sub_agents      │  expert_sub_agent_mapping  (association)         │
│ ─────────────── │ ────────────────────────────────────────────────  │
│  id (PK)         │  expert_agent_id (FK → expert_agents.id)         │
│  name (unique)   │  sub_agent_id    (FK → sub_agents.id)            │
│  description     │  [composite PK: both columns]                    │
│  group_type      │  [CASCADE delete on both FKs]                    │
│  created_at      │                                                  │
│  updated_at      │                                                  │
├──────────────────┼──────────────────────────────────────────────────┤
│  agent_interactions                │  system_logs                   │
│ ─────────────────────────────────  │ ─────────────────────────────  │
│  id (PK)                           │  id (PK)                       │
│  expert_agent_id (FK → expert_...) │  created_at                    │
│  sub_agent_id    (FK → sub_...)    │  level  [CHECK constraint]     │
│  input_prompt                      │  source                        │
│  output_response                   │  message                       │
│  duration_ms                       │  metadata_json                 │
│  input_tokens                      │                                │
│  output_tokens                     │                                │
│  created_at                        │                                │
└────────────────────────────────────┴────────────────────────────────┘
```

---

## 6. API Endpoints Reference

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/login` | Authenticate user, receive signed JWT | No |

**Request body:**
```json
{ "username": "admin", "password": "admin" }
```
**Response:**
```json
{
  "status": "success",
  "token": "eyJhbGci...",
  "id": 1,
  "username": "admin",
  "email": "admin@localhost",
  "role": "admin"
}
```

---

### Agents

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/agents/` | List all active Expert Agents | No (future: Yes) |
| `POST` | `/api/agents/{id}/select` | Select an Expert Agent by ID | No (future: Yes) |

**GET `/api/agents/` response:**
```json
[
  {
    "id": 1,
    "name": "UI Color Palette Manager",
    "code_name": "ui_color_palate_manager",
    "description": "Domain expert for handling UI Color Palette",
    "color_theme": "#334155",
    "is_active": true,
    "created_at": "2026-06-10T...",
    "updated_at": "2026-06-10T...",
    "specific_sub_agents": []
  },
  ...
]
```

**POST `/api/agents/{id}/select` response:**
```json
{
  "status": "success",
  "message": "Agent 'OT Plant Data Manager' selected successfully.",
  "agent_id": 2
}
```

---

### Logs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/logs/` | Get recent log entries (newest first, max 500) | No (future: Yes) |
| `POST` | `/api/logs/` | Write a log entry from the frontend | No (future: Yes) |

**Query parameters for GET:**
- `limit` — integer, 1–500, default 50

---

## 7. Authentication Flow

```
Client                    FastAPI                    Database
  │                          │                           │
  │  POST /api/auth/login     │                           │
  │  {username, password}     │                           │
  ├─────────────────────────▶│                           │
  │                          │  SELECT * FROM users      │
  │                          │  WHERE username=...       │
  │                          ├──────────────────────────▶│
  │                          │◀──────────────────────────┤
  │                          │  user row returned        │
  │                          │                           │
  │                          │  bcrypt.verify(           │
  │                          │    password,              │
  │                          │    user.hashed_password)  │
  │                          │                           │
  │                          │  jwt.encode({             │
  │                          │    sub: user.id,          │
  │                          │    role: user.role,       │
  │                          │    exp: now + 60min       │
  │                          │  }, JWT_SECRET_KEY)       │
  │                          │                           │
  │  {status, token, ...}     │                           │
  │◀─────────────────────────┤                           │
  │                          │                           │
  │  [client stores token]   │                           │
  │  [sends as Bearer on     │                           │
  │   future requests]       │                           │
```

**Security properties:**
- Passwords stored as bcrypt hashes (`passlib` + `bcrypt 4.0.1`), never as plaintext.
- JWTs signed with HS256 using `JWT_SECRET_KEY` from environment — never hardcoded.
- Token expiry controlled by `JWT_EXPIRE_MINUTES` env var (default 60 minutes).
- The `sub` claim contains the user ID; `role` claim enables future role-based access control.

---

## 8. Request Lifecycle — End to End

Here is the complete journey of a **"select an agent"** request through every layer of the system:

```
Step 1 — Client sends request
  POST /api/agents/3/select
  Header: Authorization: Bearer eyJ...

Step 2 — FastAPI receives and validates
  • Matches route: POST /api/agents/{agent_id}/select
  • Pydantic validates agent_id is an integer
  • get_db() dependency injects a SQLAlchemy session

Step 3 — Handler queries the database
  SELECT * FROM expert_agents
  WHERE id = 3 AND is_active = true

Step 4 — Handler writes a system log
  INSERT INTO system_logs
  (level, source, message, metadata_json)
  VALUES ('INFO', 'USER',
          'Agent OT Plant Data Manager (ID: 3) selected by user.',
          '{"agent_id": 3, "name": "OT Plant Data Manager"}')

Step 5 — Handler returns response
  Pydantic serialises the dict into AgentSelectResponse
  {
    "status": "success",
    "message": "Agent 'OT Plant Data Manager' selected successfully.",
    "agent_id": 3
  }

Step 6 — Session closed
  get_db() finally block calls db.close()
  Connection returned to the pool
```

---

## 9. Module Map

```
backend/
│
├── seed.py                      ← One-time DB population script
│                                  Creates tables, inserts 8 Expert Agents + admin user
│
└── app/
    │
    ├── main.py                  ← FastAPI app, lifespan, CORS, router registration
    ├── database.py              ← Engine, SessionLocal, Base, get_db() dependency
    │
    ├── models/                  ← SQLAlchemy ORM table definitions
    │   ├── __init__.py
    │   ├── user.py              ← User (authentication)
    │   ├── agent.py             ← ExpertAgent, SubAgent, AgentInteraction
    │   └── log.py               ← SystemLog
    │
    ├── schemas/                 ← Pydantic request/response validation
    │   ├── __init__.py
    │   ├── user.py              ← UserLogin, LoginResponse, UserCreate, UserResponse
    │   ├── agent.py             ← ExpertAgentResponse, SubAgentResponse,
    │   │                           AgentSelectResponse, AgentInteractionResponse
    │   └── log.py               ← SystemLogCreate, SystemLogResponse
    │
    ├── api/                     ← FastAPI route handlers
    │   ├── __init__.py
    │   ├── auth.py              ← POST /api/auth/login
    │   ├── agents.py            ← GET /api/agents/, POST /api/agents/{id}/select
    │   └── logs.py              ← GET /api/logs/, POST /api/logs/
    │
    └── database_test.py         ← Step-by-step tests for database.py (9 steps)
```

---

## 10. Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| **ORM** | SQLAlchemy 2.0 | Industry standard, supports both SQLite (dev) and PostgreSQL (prod) with no code changes |
| **Validation** | Pydantic v2 | Fast, type-safe request/response contracts; `from_attributes=True` bridges ORM↔schema seamlessly |
| **Password hashing** | bcrypt via passlib | Industry standard; work factor is tunable for future hardening |
| **Token format** | HS256 JWT via python-jose | Stateless auth; `sub` + `role` claims support future RBAC without DB lookup per request |
| **DB init** | `lifespan` handler | Avoids side effects at import time; compatible with pytest fixtures and Alembic migrations |
| **Log ordering** | Descending (newest first) | Monitoring UIs always want latest events at the top |
| **Soft delete** | `is_active` boolean | Expert Agents can be deactivated without losing their history or interaction records |
| **Cascade deletes** | `ondelete='CASCADE'` on FKs | Deleting an Expert Agent automatically cleans up its mapping rows — no orphan data |
| **Many-to-many** | Explicit association table | Allows Sub-Agents to be shared across Expert Agents (CAG pattern) without duplication |
| **Dev vs Prod DB** | ENV variable gate | Same codebase runs on SQLite locally and PostgreSQL in production; no code branching |

---

*Next steps before frontend integration:*
- *Add JWT Bearer token verification middleware to protect agent and log endpoints.*
- *Implement Alembic migrations to replace `create_all` for production schema management.*
- *Wire Sub-Agents to actual LLM calls (e.g. Claude API) within the `AgentInteraction` lifecycle.*
