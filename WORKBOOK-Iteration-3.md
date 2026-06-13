# WORKBOOK — Iteration 3: User Management

**Project:** CDAGS AI-Agents — OT-IT Convergence & Cybersecurity
**Iteration:** 3 (User Management)
**Completed:** 2026-06-13
**Branch:** `iteration-2`

This workbook is a step-by-step tutorial that documents every design decision, code change, and the reasoning behind it for Iteration 3. It is intended to be read by a developer who wants to understand *why* the code is the way it is — not just what it does.

---

## Table of Contents

1. [What We Built](#1-what-we-built)
2. [Design Decisions Made Before Writing Code](#2-design-decisions-made-before-writing-code)
3. [Step 1 — Backend: Extend the User Model](#3-step-1--backend-extend-the-user-model)
4. [Step 2 — Backend: New Pydantic Schemas](#4-step-2--backend-new-pydantic-schemas)
5. [Step 3 — Backend: User API Router](#5-step-3--backend-user-api-router)
6. [Step 4 — Backend: Register the Router in main.py](#6-step-4--backend-register-the-router-in-mainpy)
7. [Step 5 — Backend: Database Migrations in seed.py](#7-step-5--backend-database-migrations-in-seedpy)
8. [Step 6 — Frontend: TypeScript Types](#8-step-6--frontend-typescript-types)
9. [Step 7 — Frontend: useUserMgmt Hook](#9-step-7--frontend-useusermgmt-hook)
10. [Step 8 — Frontend: UserMgmtView Component](#10-step-8--frontend-usermgmtview-component)
11. [Step 9 — Frontend: Banner Role Fix](#11-step-9--frontend-banner-role-fix)
12. [Step 10 — Frontend: AdminBanner Grid/Tile Disable](#12-step-10--frontend-adminbanner-gridtile-disable)
13. [Step 11 — UX Polish Pass](#13-step-11--ux-polish-pass)
14. [Step 12 — TypeScript Check and Commit](#14-step-12--typescript-check-and-commit)
15. [Key Patterns Reference](#15-key-patterns-reference)

---

## 1. What We Built

Iteration 3 adds a full **User Management** feature to the admin app. At the end of this iteration:

- The backend has a new set of API endpoints (`/api/users/`) for creating, reading, updating, and deleting users — all protected by a superuser-only JWT gate.
- The database has three new columns on the `users` table (`is_active`, `corporate_id`, `uid`) and a new join table (`user_ea_access`) for per-user Expert Agent access control.
- The frontend has a complete `UserMgmtView` with a form, a role matrix table, live search/filter, sort arrows, scrolling, and an EA access panel.
- A 10-role RBAC model is fully defined in both the backend (as a `frozenset`) and the frontend (as TypeScript types and constants).

---

## 2. Design Decisions Made Before Writing Code

### Why 10 roles?

The system serves very different kinds of users. A single `admin` role is too coarse — it gives everyone the same level of access. The 10-role model maps directly to the 7 Expert Agents (one admin role per EA) plus 3 cross-cutting roles (superuser, operator, general-user):

| Role | Who uses it |
|------|------------|
| `superuser` | System administrators — full control including User Mgmt |
| `operator` | Plant operations staff — read-only + activate/deactivate EAs |
| `admin-*` (7 roles) | Named EA administrators — one human counterpart per EA |
| `general-user` | Plant workers — Prompt Window + Health Status only |
| `admin` | Legacy seed user — kept for backward compat during migration |

### Why `uid` instead of just using the database `id`?

The database `id` is a SQLite auto-increment integer. It leaks information (user count, insertion order) and is not stable across environments (dev vs prod have different sequences). An 8-character UUID hex (`uuid.uuid4().hex[:8]`) is:
- Short enough to display in a table column
- Globally unique enough for audit trail purposes in this system
- Immutable — it never changes even if the user is updated

### Why a join table for general-user EA access?

A general-user may need access to one, several, or all Expert Agents. The alternatives were:
- A JSON array column on `users` — harder to query, no referential integrity
- A comma-separated string — worse
- A join table (`user_ea_access`) — proper relational design, supports `CASCADE DELETE`, and is easy to query

The join table approach is the standard relational pattern and was chosen as best practice.

### Why is username format enforced as `first.l`?

The format `first_name.last_initial` (e.g. `alice.s`) is human-readable, short, and unambiguous in most small-to-medium teams. If there's a collision (two Alice Smiths), a digit is appended (`alice.s7`). The regex `^[a-z]+\.[a-z]\d*$` enforces this in the frontend form.

### Why not store password in any schema?

Passwords are hashed immediately on the backend using `bcrypt` via `passlib`. They are never stored or returned in plain text. The frontend sends the plain password over HTTPS to the `POST /api/users/` or `POST /api/users/{id}/reset-password` endpoint, which hashes it before writing to the DB.

### Why is `getEaAccess` not stored in hook state?

EA access is only relevant when a `general-user` row is selected in the role matrix. Storing it globally in the hook would require clearing it on every row switch and keeping it in sync with updates. Instead, it is fetched on-demand when a row is clicked and discarded when the selection changes. The hook returns the raw data directly from the API call.

---

## 3. Step 1 — Backend: Extend the User Model

**File:** `backend/app/models/user.py`

### What changed

Three new columns were added to the `User` class, and a new `UserEaAccess` model was added to the same file.

### The new columns

```python
is_active    = Column(Boolean,  nullable=False, default=True)
corporate_id = Column(String,   nullable=True)
uid          = Column(String,   unique=True, nullable=False, index=True)
```

- `is_active`: Soft-suspend flag. `True` by default. Suspended users cannot log in (future enforcement). Admins can toggle this without deleting the user.
- `corporate_id`: Optional. Some organizations assign employees an alphanumeric ID in their HR/identity system. Storing it here makes the CDAGS user linkable to external systems.
- `uid`: The immutable 8-character UUID hex. **Not given a `default=` at the ORM level** — it must be explicitly set at creation time (`uuid.uuid4().hex[:8]`). This prevents accidental empty-string uids.

### The relationship

```python
ea_access = relationship("UserEaAccess", back_populates="user", cascade="all, delete-orphan")
```

`cascade="all, delete-orphan"` means: when a User is deleted, all their `UserEaAccess` rows are automatically deleted too. This prevents orphaned rows in the join table.

### The `UserEaAccess` model

```python
class UserEaAccess(Base):
    __tablename__ = 'user_ea_access'

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    expert_agent_id = Column(Integer, ForeignKey('expert_agents.id', ondelete='CASCADE'), nullable=False)

    __table_args__ = (UniqueConstraint('user_id', 'expert_agent_id', name='uq_user_ea'),)

    user = relationship("User", back_populates="ea_access")
```

Key points:
- `ondelete='CASCADE'` on both foreign keys means SQLite will enforce deletion at the DB level too (belt-and-suspenders with the ORM cascade).
- `UniqueConstraint('user_id', 'expert_agent_id')` prevents duplicate grants. The API returns `409 Conflict` if you try to add the same access twice.
- The `ExpertAgent` side does NOT have a back-reference — we never need to ask "which users have access to this EA?" in the current UX.

### Complete file

```python
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = 'users'

    id               = Column(Integer,  primary_key=True, index=True)
    username         = Column(String,   unique=True, index=True, nullable=False)
    email            = Column(String,   unique=True, nullable=False)
    hashed_password  = Column(String,   nullable=False)
    role             = Column(String,   nullable=False, default='general-user')
    is_active        = Column(Boolean,  nullable=False, default=True)
    corporate_id     = Column(String,   nullable=True)
    uid              = Column(String,   unique=True, nullable=False, index=True)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                              onupdate=lambda: datetime.now(timezone.utc))

    ea_access = relationship("UserEaAccess", back_populates="user", cascade="all, delete-orphan")


class UserEaAccess(Base):
    __tablename__ = 'user_ea_access'

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    expert_agent_id = Column(Integer, ForeignKey('expert_agents.id', ondelete='CASCADE'), nullable=False)

    __table_args__ = (UniqueConstraint('user_id', 'expert_agent_id', name='uq_user_ea'),)

    user = relationship("User", back_populates="ea_access")
```

---

## 4. Step 2 — Backend: New Pydantic Schemas

**File:** `backend/app/schemas/user.py`

### Why Pydantic schemas?

FastAPI uses Pydantic models for:
1. **Request validation** — incoming JSON is validated against the schema before the handler runs.
2. **Response serialization** — outgoing data is converted to JSON using the schema's field definitions.

The schema layer is separate from the ORM model layer by design. A `User` ORM object has a `hashed_password` — we never want that in an API response. The `UserListItem` schema explicitly lists only the fields we want to expose.

### `VALID_ROLES`

```python
VALID_ROLES: frozenset = frozenset({
    "superuser", "operator",
    "admin-data-manager", "admin-asset-register-manager",
    "admin-asset-risk-manager", "admin-change-manager",
    "admin-logging-manager", "admin-siem-manager",
    "admin-reports-manager", "general-user",
    "admin",  # legacy — keep during migration
})
```

A `frozenset` (immutable set) is used for O(1) membership testing (`if role not in VALID_ROLES`). Imported by both the API router and the seed script so the list is defined exactly once.

### Schema summary

| Schema | Direction | Purpose |
|--------|-----------|---------|
| `UserCreateAdmin` | Request (POST /users/) | Create a new user |
| `UserListItem` | Response | User data returned in list and CRUD responses |
| `UserUpdate` | Request (PATCH /users/{id}) | Partial update — all fields Optional |
| `PasswordReset` | Request (POST /users/{id}/reset-password) | New password only |
| `EaAccessItem` | Response | Single EA access row |
| `EaAccessUpdate` | Request (POST /users/{id}/ea-access) | Which EA to grant |

### The `UserUpdate` pattern

```python
class UserUpdate(BaseModel):
    email:        Optional[EmailStr] = None
    role:         Optional[str]      = None
    corporate_id: Optional[str]      = None
    is_active:    Optional[bool]     = None
```

All fields are `Optional` with a default of `None`. In the API handler, `payload.model_dump(exclude_none=True)` gives us only the fields that were actually sent — so a PATCH that only changes `role` won't accidentally clear `email`.

**Note:** `username` is not in `UserUpdate` — it is immutable after creation.

---

## 5. Step 3 — Backend: User API Router

**File:** `backend/app/api/users.py` *(new file)*

### The `require_superuser` dependency

```python
from app.api.auth import require_jwt, pwd_context

def require_superuser(payload: dict = Depends(require_jwt)) -> dict:
    if payload.get("role") not in ("superuser", "admin"):
        raise HTTPException(status_code=403, detail="Superuser role required")
    return payload
```

This is a FastAPI dependency that **chains** onto `require_jwt`. The flow is:
1. FastAPI extracts the `Authorization: Bearer <token>` header.
2. `require_jwt` validates the JWT and returns the decoded payload dict.
3. `require_superuser` receives that dict and checks the `role` claim.
4. If the role is not `superuser` or `admin`, a `403 Forbidden` is raised.
5. Otherwise, the payload is passed through to the handler.

This means every endpoint that declares `_token: dict = Depends(require_superuser)` automatically requires a valid JWT *and* a superuser role.

### Why import `pwd_context` from `auth.py`?

`pwd_context` is the `passlib.CryptContext` instance configured for bcrypt. It was already defined in `auth.py` for the login endpoint. Rather than create a second instance, we import it directly. This ensures the same bcrypt configuration (cost factor, deprecated schemes) is used everywhere.

### Endpoint walkthrough

#### `GET /api/users/`

```python
@router.get("/", response_model=List[UserListItem])
def list_users(db: Session = Depends(get_db), _token: dict = Depends(require_superuser)):
    return db.query(User).order_by(User.username).all()
```

Returns all users ordered alphabetically by username. SQLAlchemy serializes each `User` ORM object into a `UserListItem` Pydantic model (via `from_attributes = True` in the schema's `Config`).

#### `POST /api/users/`

```python
@router.post("/", response_model=UserListItem, status_code=201)
def create_user(payload: UserCreateAdmin, ...):
    if payload.role not in VALID_ROLES:
        raise HTTPException(400, ...)
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(409, "Username already exists")
    if db.query(User).filter_by(email=str(payload.email)).first():
        raise HTTPException(409, "Email already exists")

    user = User(
        ...
        uid=uuid.uuid4().hex[:8],
    )
```

Three validations before insert:
1. Role is in the allowed set.
2. Username is unique (HTTP 409 Conflict, not 400 Bad Request — 409 means "the resource already exists").
3. Email is unique.

`uid` is generated here — `uuid.uuid4().hex[:8]` gives an 8-character lowercase hex string like `"a3f9c1b2"`.

#### `PATCH /api/users/{id}`

```python
update_data = payload.model_dump(exclude_none=True)
for field, value in update_data.items():
    setattr(user, field, value)
```

`model_dump(exclude_none=True)` returns only the fields that were explicitly provided in the request body. We then use `setattr` to apply each one to the ORM object. This is the standard FastAPI/SQLAlchemy pattern for partial updates.

#### `DELETE /api/users/{id}` — HTTP 204

A successful delete returns HTTP 204 (No Content) — no response body. This is the correct REST convention for destructive operations.

#### `POST /api/users/{id}/ea-access` — 409 tolerance

```python
if db.query(UserEaAccess).filter_by(user_id=user_id, expert_agent_id=payload.expert_agent_id).first():
    raise HTTPException(status_code=409, detail="EA access entry already exists")
```

The frontend handles `409` as a success (the entry already exists, which is the desired state). This makes the operation idempotent from the frontend's perspective.

---

## 6. Step 4 — Backend: Register the Router in main.py

**File:** `backend/app/main.py`

One line added:

```python
from app.api import auth, agents, logs, users   # added 'users'
app.include_router(users.router, prefix="/api")
```

The `users` router has `prefix="/users"` internally, so all its endpoints are mounted at `/api/users/`. The `user_ea_access` table is created automatically on the next `Base.metadata.create_all()` call (which runs on app startup via the lifespan handler) because `UserEaAccess` is defined in `models/user.py`, which is already imported by the time `create_all` runs.

---

## 7. Step 5 — Backend: Database Migrations in seed.py

**File:** `backend/seed.py`

### The migration challenge

SQLite has a major limitation: you cannot add a column with a `UNIQUE` constraint via `ALTER TABLE`. The error is:
```
OperationalError: Cannot add a column with non-constant default
```

The workaround used throughout this project is:
1. Add the column plain (no `UNIQUE`).
2. Then create a `UNIQUE INDEX` separately.

This is the same pattern used for `sub_agents.code_name` in Iteration 2.

### The `_migrate_add_column_if_missing` helper

```python
def _migrate_add_column_if_missing(column: str, table: str, definition: str) -> None:
    with engine.connect() as conn:
        cols = [row[1] for row in conn.execute(
            text(f"PRAGMA table_info({table})")
        ).fetchall()]
        if column not in cols:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            conn.commit()
```

`PRAGMA table_info(table_name)` returns one row per column. `row[1]` is the column name. We check if the target column is already in that list before running `ALTER TABLE` — SQLite does not support `IF NOT EXISTS` for column additions.

### Migration block for Iteration 3

```python
_migrate_add_column_if_missing("is_active",    "users", "BOOLEAN NOT NULL DEFAULT 1")
_migrate_add_column_if_missing("corporate_id", "users", "VARCHAR")
_migrate_add_column_if_missing("uid",          "users", "VARCHAR")
```

`is_active` uses `NOT NULL DEFAULT 1` so existing rows get `is_active = True` automatically. `uid` is added plain (`VARCHAR`) — the unique index is created separately.

### Back-filling `uid` for existing rows

```python
rows = conn.execute(text("SELECT id FROM users WHERE uid IS NULL")).fetchall()
for row in rows:
    conn.execute(text("UPDATE users SET uid=:u WHERE id=:id"),
                 {"u": uuid.uuid4().hex[:8], "id": row[0]})
```

Any existing user rows that existed before this migration have `uid = NULL`. We generate a unique uid for each one. This back-fill runs before the unique index is created.

### Creating the unique index

```python
idxs = [r[1] for r in conn.execute(text("PRAGMA index_list(users)")).fetchall()]
if "ix_users_uid" not in idxs:
    conn.execute(text("CREATE UNIQUE INDEX ix_users_uid ON users (uid)"))
    conn.commit()
```

`PRAGMA index_list(table)` returns existing indexes. We check before creating to avoid a "index already exists" error on re-runs.

### Idempotent seed log (Q1 fix)

**Problem:** Every run of `seed.py` was appending a "Database seed completed" log entry, cluttering the log panel.

**Fix:**
```python
existing_seed_log = db.query(SystemLog).filter(
    SystemLog.source == "SYSTEM",
    SystemLog.message == "Database seed completed.",
).first()
if not existing_seed_log:
    db.add(SystemLog(...))
```

We check for an existing entry before inserting. The combination of `source == "SYSTEM"` and the exact message string is specific enough to identify the seed log uniquely.

### Seeding `mike.k`

```python
mike, created = _get_or_create(
    db, User,
    lookup_kwargs={"username": "mike.k"},
    create_kwargs={
        "email": "mike.king@cdags.local",
        "hashed_password": pwd_context.hash("Admin1234!"),
        "role": "superuser",
        "is_active": True,
        "corporate_id": None,
        "uid": uuid.uuid4().hex[:8],
    })
```

`_get_or_create` looks up by `username` first. If found, it returns the existing record without modification. If not found, it creates one with the `create_kwargs`. This means re-running `seed.py` will never change `mike.k`'s password or role.

---

## 8. Step 6 — Frontend: TypeScript Types

**File:** `frontend/src/types/index.ts`

All shared types live in one file — this is a project convention. Component-local types are an anti-pattern here because they create import cycles and make it hard to find the canonical definition.

### `UserRole` type

```typescript
export type UserRole =
  | 'superuser' | 'operator'
  | 'admin-data-manager' | 'admin-asset-register-manager'
  | 'admin-asset-risk-manager' | 'admin-change-manager'
  | 'admin-logging-manager' | 'admin-siem-manager'
  | 'admin-reports-manager' | 'general-user' | 'admin';
```

A TypeScript union type. This gives us compile-time checking — if you try to assign an unknown role string to a `UserRole` variable, TypeScript will error. It matches the backend's `VALID_ROLES` frozenset exactly.

### `ALL_ROLES` constant

```typescript
export const ALL_ROLES: UserRole[] = [
  'superuser', 'operator', 'admin-data-manager',
  'admin-asset-register-manager', 'admin-asset-risk-manager',
  'admin-change-manager', 'admin-logging-manager',
  'admin-siem-manager', 'admin-reports-manager', 'general-user',
];
```

Excludes `'admin'` (legacy). Used to render the role matrix columns and the role `<select>` dropdown. By iterating `ALL_ROLES`, the column order is deterministic and consistent.

### `ROLE_SHORT` — column header codes

```typescript
export const ROLE_SHORT: Record<string, string> = {
  'superuser':                    'SU',
  'operator':                     'OPR',
  'admin-data-manager':           'DATA',
  'admin-asset-register-manager': 'ASSET-REG',
  'admin-asset-risk-manager':     'ASSET-RISK',
  'admin-change-manager':         'CHANGE',    // not CHG
  'admin-logging-manager':        'LOG',
  'admin-siem-manager':           'SIEM',
  'admin-reports-manager':        'REPORTS',   // not RPT
  'general-user':                 'GENERAL',   // not GEN
};
```

Three of the original short codes were renamed for clarity: `CHG → CHANGE`, `RPT → REPORTS`, `GEN → GENERAL`. The short codes appear as column headers in the role matrix and in the role filter dropdown.

---

## 9. Step 7 — Frontend: useUserMgmt Hook

**File:** `frontend/src/admin/hooks/useUserMgmt.ts` *(new file)*

### Why a custom hook?

Following the pattern established in `useAdminAgents.ts`, all data-fetching and mutation logic lives in a custom hook rather than directly in the view component. This separation means:
- The view component is purely presentational.
- The hook is independently testable.
- The hook handles auth (401 → logout) in one place.

### The `authHeader` helper

```typescript
const authHeader = (): Record<string, string> =>
  session ? { Authorization: `Bearer ${session.token}` } : {};
```

Returns the `Authorization` header if a session exists, or an empty object if not. Spread into every `fetch` call: `headers: { 'Content-Type': 'application/json', ...authHeader() }`.

### `fetchUsers` and the `useCallback` + `useEffect` pattern

```typescript
const fetchUsers = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/users/', { headers: authHeader() });
    if (res.status === 401) { logout(); return; }
    if (res.status === 403) { setError('Access denied — superuser role required.'); return; }
    if (!res.ok) { setError(`Server error: ${res.status}`); return; }
    const data: UserListItem[] = await res.json();
    setUsers(data);
  } catch {
    setError('Could not reach the backend.');
  } finally {
    setLoading(false);
  }
}, [session, logout]);

useEffect(() => { fetchUsers(); }, [fetchUsers]);
```

`useCallback` memoizes `fetchUsers` so it only changes identity when `session` or `logout` changes. `useEffect` calls it once on mount and again whenever the identity changes (i.e., when the user logs in or the session is refreshed). Mutating functions (`createUser`, `deleteUser`, etc.) call `fetchUsers()` after success to re-sync the list.

### `logAdminAction` — audit logging

```typescript
const logAdminAction = useCallback(async (message: string): Promise<void> => {
  if (!session) return;
  try {
    await fetch('/api/logs/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ level: 'INFO', source: 'USER', message }),
    });
  } catch {
    // best-effort — don't block the UI on audit log failures
  }
}, [session]);
```

Every admin action (create, update, delete, role change, suspend, EA toggle) calls `logAdminAction` with a human-readable message. The `try/catch` swallows errors — a failed audit log should never prevent the actual operation from completing or show an error to the user.

### `getEaAccess` — on-demand, not cached

```typescript
const getEaAccess = useCallback(async (userId: number): Promise<EaAccessItem[]> => {
  try {
    const res = await fetch(`/api/users/${userId}/ea-access`, { headers: authHeader() });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}, [session]);
```

Returns data directly instead of storing in `useState`. Called by `UserMgmtView` when a general-user row is selected. The result is stored in the view's own `eaAccessList` state and cleared when the selection changes.

---

## 10. Step 8 — Frontend: UserMgmtView Component

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

### Access guard

```tsx
if (session?.role !== 'superuser' && session?.role !== 'admin') {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ background: 'rgba(220,20,60,0.12)', border: '1px solid #dc143c', ... }}>
        Access Denied — Superuser role required.
      </div>
    </div>
  );
}
```

The first thing rendered after the hooks run. If the user somehow navigates to this view without the right role, they see an access denied message. The backend also enforces this at the API level (403 Forbidden), but the frontend guard provides immediate feedback without a network round-trip.

### State management

```typescript
const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
const [form, setForm] = useState<FormState>(emptyForm);
const [eaAccessList, setEaAccessList] = useState<EaAccessItem[]>([]);
const [showEaPanel, setShowEaPanel] = useState(false);
const [toast, setToast] = useState<string | null>(null);
const [search, setSearch] = useState('');
const [roleFilter, setRoleFilter] = useState<string>('');
const [sortField, setSortField] = useState<SortField>('username');
const [sortDir, setSortDir] = useState<SortDir>('asc');
const [showPassword, setShowPassword] = useState(false);
```

All state is local to the component. There is no global state for user management — it's not needed by any other part of the app.

### `displayUsers` — derived filtered/sorted list

```typescript
const displayUsers = useMemo(() => {
  const q = search.toLowerCase().trim();
  let filtered = q ? users.filter(u => u.username.toLowerCase().includes(q)) : users;
  if (roleFilter) filtered = filtered.filter(u => u.role === roleFilter);
  return [...filtered].sort((a, b) => {
    let va: string, vb: string;
    if (sortField === 'is_active') { va = a.is_active ? 'a' : 'b'; vb = b.is_active ? 'a' : 'b'; }
    else { va = (a[sortField] as string).toLowerCase(); vb = (b[sortField] as string).toLowerCase(); }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
}, [users, search, roleFilter, sortField, sortDir]);
```

`useMemo` recalculates only when one of the dependencies changes. The original `users` array from the hook is never mutated — a new sorted/filtered array is returned each time. The `is_active` sort uses `'a'/'b'` as sort keys (Active sorts before Suspended in ascending).

### Section 1 — Add/Edit Form

The form has two rows:
- **Row 1 (editable):** Username, Email, Password, Corporate ID — 4-column grid.
- **Row 2 (mixed):** Date Created (read-only), System UID (read-only), Role select, Action buttons.

The read-only/editable distinction is enforced visually by two separate style objects:

```typescript
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', ...
};

const readonlyStyle: React.CSSProperties = {
  ...inputStyle,
  background: '#1a1f2e',        // darker — clearly non-editable
  color: 'var(--text-tertiary)',
  border: '1px solid transparent',
  cursor: 'default',
};
```

The label for read-only fields is also more muted:
```typescript
const readonlyLabelStyle: React.CSSProperties = {
  ...labelStyle,
  color: '#475569',
};
```

This double signal (darker background + muted label) makes it immediately obvious that these fields cannot be typed into.

### Password show/hide toggle

```tsx
<div style={{ position: 'relative' }}>
  <input
    style={{ ...inputStyle, paddingRight: '34px' }}
    type={showPassword ? 'text' : 'password'}
    value={form.password}
    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
  />
  <button
    type="button"
    onClick={() => setShowPassword(v => !v)}
    style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', ... }}
  >
    {showPassword ? <EyeSlashSVG /> : <EyeSVG />}
  </button>
</div>
```

The button is `position: absolute` inside a `position: relative` wrapper, aligned vertically center to the input. Extra `paddingRight: '34px'` prevents the text from running under the icon. SVG icons are inline (no external library needed).

### The `RoleDot` component

```tsx
const RoleDot: React.FC<{ active: boolean; onClick?: () => void }> = ({ active, onClick }) => (
  <span
    onClick={onClick}
    style={{
      display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
      backgroundColor: active ? '#00ff88' : '#dc143c',
      cursor: onClick && !active ? 'pointer' : 'default',
    }}
  />
);
```

A green dot = current role. A crimson dot = not the current role. Only non-current dots get a `pointer` cursor and an `onClick`. Clicking a non-current dot calls `handleRoleChange(user, role)`, which shows a `window.confirm()` before PATCHing the role.

### Section 2 — Search/Filter/Sort bar

```tsx
<input
  value={search}
  onChange={e => setSearch(e.target.value)}
  placeholder="Filter by username…"
/>
<select
  value={roleFilter}
  onChange={e => setRoleFilter(e.target.value)}
>
  <option value="">All roles</option>
  {ALL_ROLES.map(r => (
    <option key={r} value={r}>{ROLE_SHORT[r] ?? r} — {ROLE_LABELS[r]}</option>
  ))}
</select>
```

The dropdown option format `SU — Superuser` makes it self-documenting — users learn what the column headers mean from the dropdown.

The `SortArrow` component:

```tsx
const SortArrow: React.FC<{...}> = ({ field, sortField, sortDir, onSort }) => (
  <span onClick={() => onSort(field)} style={{ opacity: sortField === field ? 1 : 0.35 }}>
    {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
);
```

When inactive (not the current sort column), the arrow is dimmed to 35% opacity and shows `⇅`. When active, it shows `▲` or `▼` at full opacity. Clicking toggles the direction if already active, or resets to ascending if switching columns.

### The scrollable table

```tsx
<div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
  <table>
    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
```

`position: sticky; top: 0` on the `<thead>` makes the column headers stay visible as you scroll down the table body. The `zIndex: 1` ensures the header renders above the rows during scroll.

### Section 3 — EA Access Panel

Only shown when `showEaPanel === true` (set when a `general-user` row is selected):

```tsx
{showEaPanel && selectedUser && (
  <div>
    {agents.map(ea => {
      const has = eaAccessList.some(e => e.expert_agent_id === ea.id);
      return (
        <div onClick={() => handleEaToggle(ea)}
          style={{ border: `1px solid ${has ? '#15803d' : 'var(--border-color)'}` }}>
          <span style={{ backgroundColor: ea.color_theme }} />
          <span>{ea.name}</span>
          <span style={{ backgroundColor: has ? '#00ff88' : '#dc143c' }} />
        </div>
      );
    })}
  </div>
)}
```

Each EA card shows:
1. The EA's color swatch (from `ea.color_theme`)
2. The EA's name
3. A status dot (green = has access, crimson = no access)

The card border also turns green when access is granted, giving a second visual signal.

### Toast notifications

```typescript
useEffect(() => {
  if (!toast) return;
  const t = setTimeout(() => setToast(null), 3000);
  return () => clearTimeout(t);
}, [toast]);
```

A 3-second auto-dismiss. The cleanup function (`return () => clearTimeout(t)`) prevents a memory leak if a new toast arrives before the timer fires.

---

## 11. Step 9 — Frontend: Banner Role Fix

**File:** `frontend/src/components/Layout/Banner.tsx`

One-line change:

```tsx
// Before
{session?.role === 'admin' && (

// After
{(session?.role === 'admin' || session?.role === 'superuser') && (
```

The `⚙ Admin` button was only visible to the legacy `admin` role. `mike.k` (the new `superuser`) could not see it. Adding `|| session?.role === 'superuser'` fixes this.

---

## 12. Step 10 — Frontend: AdminBanner Grid/Tile Disable

**File:** `frontend/src/admin/components/AdminBanner.tsx`

### The problem

The Grid/Tile toggle appeared in the admin banner for all views — including User Mgmt and Prompt Window, which don't have grid/tile variants. The buttons were functional but clicking them had no visible effect, which was confusing.

### The fix

`AdminBanner` received a new prop `activeView: AdminNavView`:

```typescript
interface AdminBannerProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeView: AdminNavView;  // new
}
```

```typescript
const toggleDisabled = activeView === 'user-mgmt' || activeView === 'prompt-window';
```

The toggle buttons use this flag:

```tsx
<div style={{ opacity: toggleDisabled ? 0.35 : 1 }}>
  {(['grid', 'tile'] as const).map(mode => (
    <button
      key={mode}
      disabled={toggleDisabled}
      onClick={() => !toggleDisabled && setViewMode(mode)}
      style={{ cursor: toggleDisabled ? 'not-allowed' : 'pointer' }}
    >
      {mode === 'grid' ? 'Grid' : 'Tile'}
    </button>
  ))}
</div>
```

`opacity: 0.35` + `disabled` + `cursor: not-allowed` together communicate "this is greyed out and not clickable" in three different ways — color, interactivity, and cursor.

`AdminApp.tsx` was updated to pass `activeView`:

```tsx
<AdminBanner viewMode={viewMode} setViewMode={setViewMode} activeView={activeView} />
```

---

## 13. Step 11 — UX Polish Pass

Several UX improvements were made after the initial implementation based on review feedback.

### Q1: Duplicate seed log entries

**Problem:** Running `seed.py` multiple times created a new "Database seed completed" log entry each time.

**Root cause:** The log entry was unconditionally appended at the end of the seed function.

**Fix:** Check for an existing entry before inserting:
```python
existing_seed_log = db.query(SystemLog).filter(
    SystemLog.source == "SYSTEM",
    SystemLog.message == "Database seed completed.",
).first()
if not existing_seed_log:
    db.add(SystemLog(...))
```

### Q2: Grid/Tile toggle visible but useless on User Mgmt

Already covered in Step 10.

### Suggestion 1: Read-only field visual distinction

Date Created and System UID use a darker background (`#1a1f2e`) and muted text (`var(--text-tertiary)`) with no visible border. This makes them look "inert" compared to the editable fields.

### Suggestion 2: Table scroll + sort + search

Three enhancements to the role matrix table:
1. **Scroll**: `max-height: 420px` + `overflow-y: auto` + `position: sticky` header.
2. **Sort**: `SortArrow` component on Username and Status columns, `useMemo` for sorted list.
3. **Search**: Live username filter + role dropdown filter, both composing, each with `✕` clear button and a `N / M users` count.

### Password show/hide icon

Initial implementation used emoji (`👁` / `🙈`). Replaced with inline SVG icons for a cleaner, more professional look consistent with the app's design language. The open-eye icon is grey when the password is hidden; the eye-slash icon turns neon blue (`var(--active-highlight)`) when the password is visible — giving an immediate state cue.

### Role filter dropdown

After search was added, a role filter dropdown was added next to it. Format: `SU — Superuser`, `OPR — Operator`, etc. This:
- Teaches users what the column short codes mean.
- Allows filtering to see "all superusers" or "all general-users" instantly.
- Composes with the username search filter.

Short code labels updated: `CHG → CHANGE`, `RPT → REPORTS`, `GEN → GENERAL` for readability.

---

## 14. Step 12 — TypeScript Check and Commit

Before every commit:

```bash
cd frontend
npx tsc --noEmit
```

This runs the TypeScript compiler in check-only mode (no output files). Zero errors is the pass condition. Throughout Iteration 3, this check was run after every change and always passed before committing.

### Commit history for Iteration 3

| Commit | What it contained |
|--------|-------------------|
| `4329dba` | Iteration 3: User Management — backend CRUD + admin UI |
| `8cd5996` | User Mgmt UX polish: read-only fields, scroll/sort/search, Grid/Tile disable |
| `5207c50` | Add show/hide toggle to password field |
| `77da0c6` | Replace emoji eye icons with SVG icons |
| `a5dadcc` | Add role filter dropdown; update short codes (CHANGE/REPORTS/GENERAL) |

---

## 15. Key Patterns Reference

### Backend patterns

| Pattern | Where used | Why |
|---------|-----------|-----|
| `_get_or_create()` | `seed.py` | Idempotent seeding — safe to re-run |
| `_migrate_add_column_if_missing()` | `seed.py` | SQLite ALTER TABLE without errors on re-run |
| `model_dump(exclude_none=True)` | `users.py` PATCH handler | Partial update — only sent fields are applied |
| `require_superuser` dependency chain | All `/api/users/` endpoints | JWT + role check in one declaration |
| `pwd_context` imported from `auth.py` | `users.py` | Single source of bcrypt config |
| `ondelete='CASCADE'` | `UserEaAccess` FKs | DB-level cleanup on user/EA delete |
| `UniqueConstraint` | `UserEaAccess` | Prevent duplicate EA access rows |

### Frontend patterns

| Pattern | Where used | Why |
|---------|-----------|-----|
| `useCallback` + `useEffect` for fetch | `useUserMgmt.ts` | Avoid stale closures; re-fetch on session change |
| `model_dump(exclude_none=True)` analogy | `updateUser()` | Only send changed fields in PATCH body |
| `useMemo` for filtered/sorted list | `UserMgmtView.tsx` | Avoid re-sorting on every render |
| Toast via `useState` + `useEffect` timeout | `UserMgmtView.tsx` | 3s auto-dismiss without a library |
| `position: sticky` thead | Role matrix table | Column headers visible during scroll |
| `position: relative` + `position: absolute` button | Password input | Eye icon overlaid on input without layout shift |
| Best-effort `logAdminAction` | Both hooks | Audit logging never blocks the UI |
| Access guard at top of render | `UserMgmtView.tsx` | Fast fail without network round-trip |
| All types in `src/types/index.ts` | Entire frontend | Single source of truth; no import cycles |
