# WORKBOOK-3b — User Management Polish & Safety Improvements

**Branch:** `iteration-2`
**Date:** 2026-06-13
**Prerequisite:** WORKBOOK-Iteration-3.md complete (Iteration 3 running and tested)

This workbook documents every change made in the Iteration 3b polish pass. It covers **10 improvements** across backend safety guards, UX correctness, and functional completeness. Each section explains what changed, why it was needed, and the exact code involved.

---

## Overview: What Was Improved

| # | Area | Description |
|---|------|-------------|
| 1 | Backend safety | Delete guards: block self-delete and last-superuser-delete |
| 2 | Frontend UX | Role dots display-only — role changes via form only |
| 3 | Frontend UX | Password reset requires explicit confirm on Update |
| 4 | Frontend UX | Search covers username, full name, and email |
| 5 | Frontend UX | Status filter (All / Active / Suspended) |
| 6 | Frontend UX | Distinct error toasts (red, 7s) vs info toasts (dark, 4s) |
| 7 | Frontend UX | Unsaved-changes guard (dirty state, blue border, confirm on discard) |
| 8 | Frontend UX | EA Access busy lock — prevents double-click races |
| 9 | Frontend fix | Export triggers real browser download (blob URL) |
| 10 | Frontend UX | Role column added to table with sort; Full Name in EA panel header |

---

## Improvement 1 — Delete Guards (Backend)

**File:** `backend/app/api/users.py`

**Problem:** A superuser could delete their own account (locking everyone out) or the only remaining superuser (same result — no one can manage users).

**Fix:** The `DELETE /api/users/{user_id}` endpoint now checks two conditions before deleting:

```python
@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db),
                token: dict = Depends(require_superuser)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Guard 1: self-delete
    if token.get("id") == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    # Guard 2: last superuser
    if user.role == "superuser":
        remaining = db.query(User).filter(
            User.role == "superuser", User.id != user_id
        ).count()
        if remaining == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last superuser — promote another user first",
            )

    db.delete(user)
    db.commit()
```

**Key points:**
- `token` replaces `_token` as the parameter name so the JWT payload is accessible (it contains `id` and `role`).
- The self-delete check uses `token.get("id")` which is the numeric user ID embedded in the JWT at login time.
- The last-superuser check queries for *other* superusers (`User.id != user_id`) and blocks the delete if `count() == 0`.
- Both return HTTP 400 (bad request) — not 403 — because the caller is authorized but the *operation* is invalid.

**Frontend handling:** The `handleDelete()` function in `UserMgmtView.tsx` shows an error toast on any failed delete:

```typescript
const ok = await deleteUser(user.id);
if (ok) {
  // success path
} else {
  showError(`Cannot delete "${user.username}" — you may be deleting yourself or the last superuser.`);
}
```

---

## Improvement 2 — Role Dots Display-Only

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:** In Iteration 3, clicking a non-current role dot fired an immediate `PATCH` role change via `window.confirm()`. A misclick on the wrong dot could accidentally promote or demote a user, and the only record was the audit log. This is too easy to do accidentally in a dense table.

**Fix:** Role dots are now pure display indicators. The `RoleDot` component no longer accepts or calls an `onClick`. Role changes happen exclusively through: (1) click the row → (2) change the Role dropdown in the form → (3) click Update.

```typescript
const RoleDot: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    title={active ? 'Current role (read-only — use form to change)' : ''}
    style={{
      display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
      backgroundColor: active ? '#00ff88' : '#dc143c',
      cursor: 'default', flexShrink: 0,
    }}
  />
);
```

The table cells render it simply:

```tsx
{ALL_ROLES.map(r => (
  <td key={r} style={{ padding: '10px 8px', textAlign: 'center' }}>
    <RoleDot active={user.role === r} />
  </td>
))}
```

The column header `title` attribute now says `"read-only, click row to edit"` to guide the user.

---

## Improvement 3 — Password Reset Requires Explicit Confirm

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:** Previously, `handleUpdate()` silently reset the password if the password field was ≥ 8 characters. A superuser editing an email who accidentally typed in the password box would reset the password without realising it.

**Fix:** When `form.password.length >= 8` during an edit, the user is asked to explicitly confirm the password reset before it is sent:

```typescript
if (form.password.length >= 8) {
  if (!window.confirm(
    `Also reset password for "${selectedUser.username}"?\nThis takes effect immediately.`
  )) {
    // User cancelled — skip password reset, but field updates still applied
  } else {
    if (!(await resetPassword(selectedUser.id, form.password))) {
      showError('Password reset failed.'); return;
    }
  }
}
```

The password field placeholder in edit mode says "Leave blank to keep current" to make the intent clear.

---

## Improvement 4 — Search Covers Full Name and Email

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:** Search only matched on `username`. Once `full_name` was added, users expect to find "Alice Smith" by typing "alice". Email search is also common when looking up a user from a ticket.

**Fix:** The `useMemo` filter now checks three fields:

```typescript
const q = search.toLowerCase().trim();
let list = q
  ? users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  : users;
```

The search placeholder is updated to say "Name, username, or email…" to communicate the expanded scope.

---

## Improvement 5 — Status Filter Dropdown

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:** With potentially many users, a superuser often needs to quickly list all suspended accounts for review. There was no way to filter by active/suspended status.

**Fix:** A third filter control is added after the Role filter:

```tsx
const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'suspended'>('');

// Applied in the useMemo:
if (statusFilter) list = list.filter(u =>
  statusFilter === 'active' ? u.is_active : !u.is_active
);

// Render:
<select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ...)}>
  <option value="">All</option>
  <option value="active">Active only</option>
  <option value="suspended">Suspended only</option>
</select>
{statusFilter && <button onClick={() => setStatusFilter('')}>✕</button>}
```

All three filters (search, role, status) compose — a superuser can find "all suspended general-users whose name contains 'smith'" in one view.

---

## Improvement 6 — Distinct Error vs Info Toasts

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:** All toasts looked identical — same dark background, same 4-second timer. A delete failure or update failure looks the same as a success message. In an admin tool this is a safety risk: the superuser might not notice the operation failed.

**Fix:** The toast state is an object with an `isError` flag:

```typescript
const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

const showInfo  = (msg: string) => setToast({ msg, isError: false });
const showError = (msg: string) => setToast({ msg, isError: true });

// Dismiss timing:
const ms = toast.isError ? 7000 : 4000;
```

The `Toast` component renders differently based on `isError`:

```tsx
const Toast: React.FC<{ msg: string; isError?: boolean }> = ({ msg, isError }) => (
  <div style={{
    background: isError ? '#3b0a0a' : '#1e293b',
    border: `1px solid ${isError ? '#dc143c' : 'transparent'}`,
    color: isError ? '#fca5a5' : '#f8fafc',
    // ... positioning ...
  }}>{msg}</div>
);
```

Error toasts: deep red background, crimson border, salmon text, stay for 7 seconds.
Info toasts: dark navy background, no border, white text, dismiss after 4 seconds.

---

## Improvement 7 — Unsaved-Changes Guard (Dirty State)

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:** If a superuser clicked a user row, edited the email, then clicked a different row, the edit was silently discarded with no warning.

**Fix:** An `isDirty` boolean tracks whether the form has been modified since it was last loaded or cleared.

```typescript
const [isDirty, setIsDirty] = useState(false);

// Every field change goes through setField(), which also marks dirty:
const setField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
  setForm(f => ({ ...f, [key]: val }));
  setIsDirty(true);
}, []);
```

`clearForm()` and `selectRow()` reset `isDirty` to `false`.

A helper `confirmDiscardIfDirty()` is called before any navigation away from the current edit:

```typescript
const confirmDiscardIfDirty = (): boolean => {
  if (!isDirty) return true;
  return window.confirm('You have unsaved changes. Discard and continue?');
};

// Used in:
const selectRow = async (user: UserListItem) => {
  if (!confirmDiscardIfDirty()) return;  // user cancelled
  // ... proceed to load new row
};

// Clear button:
<button onClick={() => { if (confirmDiscardIfDirty()) clearForm(); }}>Clear</button>
```

Visual indicator in the form header:

```tsx
// Form card border turns blue when dirty:
border: `1px solid ${isDirty ? 'rgba(59,130,246,0.4)' : 'var(--border-color)'}`,
transition: 'border-color 0.2s',

// Label appears:
{isDirty && (
  <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 400 }}>● unsaved changes</span>
)}
```

---

## Improvement 8 — EA Access Busy Lock

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:** Clicking an EA toggle card fired `addEaAccess()` or `removeEaAccess()` asynchronously. A double-click or a slow network could fire two conflicting requests simultaneously, leaving the access list in an inconsistent state.

**Fix:** An `eaBusy` boolean flag is set for the duration of the async operation. The panel fades during the request and ignores further clicks:

```typescript
const [eaBusy, setEaBusy] = useState(false);

const handleEaToggle = async (ea: ExpertAgent) => {
  if (!selectedUser || eaBusy) return;  // guard
  setEaBusy(true);
  const has = eaAccessList.some(e => e.expert_agent_id === ea.id);
  if (has) await removeEaAccess(selectedUser.id, ea.id);
  else     await addEaAccess(selectedUser.id, ea.id);
  setEaAccessList(await getEaAccess(selectedUser.id));
  setEaBusy(false);
};

// Panel visual fade:
<div style={{ opacity: eaBusy ? 0.6 : 1, transition: 'opacity 0.15s' }}>

// Card cursor during busy:
cursor: eaBusy ? 'wait' : 'pointer',
```

---

## Improvement 9 — Export Triggers Real Browser Download

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:** In Iteration 3b the `exportUsers()` hook returned a boolean but never handled the response body. The backend streamed a valid `.xlsx` file but the frontend ignored it — no file was ever downloaded. The button was effectively broken.

**Fix:** `handleExport()` now reads the response as a `Blob`, creates an object URL, and triggers the download via a hidden `<a>` element:

```typescript
const handleExport = async () => {
  if (exportBusy) return;
  setExportBusy(true);
  await logAdminAction(`Superuser "${session?.username}" triggered user roster export.`);
  try {
    const res = await fetch('/api/users/export', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'cdags_users.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    showInfo('cdags_users.xlsx downloaded — email delivery coming with Stalwart integration');
  } catch {
    showError('Export failed — check backend logs');
  } finally {
    setExportBusy(false);
  }
};
```

**How it works:**
1. `fetch()` retrieves the Excel binary from `/api/users/export`
2. `res.blob()` reads the response body as a `Blob` object
3. `URL.createObjectURL(blob)` creates a temporary browser-local URL for the blob
4. A hidden `<a>` element is clicked programmatically — browser treats it as a download
5. After 1 second the object URL is revoked and the element removed (memory cleanup)

The button label changes to "Exporting…" and is disabled during the operation to prevent double-submit.

The `exportUsers()` function in `useUserMgmt.ts` is still available for future use (e.g. Stalwart email), but `handleExport` now handles the fetch directly to get access to the raw response body.

---

## Improvement 10 — Role Column + Full Name in EA Panel

**File:** `frontend/src/admin/components/views/UserMgmtView.tsx`

**Problem:**
- The table had no plain-text "Role" column — the only role indicator was the dot matrix, which requires hovering each column header to read the label.
- The EA Access panel header showed only the `username`, not the `full_name`.

**Fix — Role column in table:**

A `Role` column is added between Status and the role dots matrix. It shows the short code (e.g. "SU", "OPR") and is sortable:

```tsx
// Header:
<th>
  Role <SortArrow field="role" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
</th>

// Cell:
<td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
  {ROLE_SHORT[user.role] ?? user.role}
</td>
```

The `SortField` type is extended: `type SortField = 'username' | 'role' | 'is_active';`

**Fix — Full Name in EA panel header:**

```tsx
EA Access — <span style={{ color: 'var(--text-primary)' }}>{selectedUser.username}</span>
{selectedUser.full_name && (
  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>
    ({selectedUser.full_name})
  </span>
)}
```

---

## Files Changed in Iteration 3b Polish

| File | What changed |
|------|-------------|
| `backend/app/api/users.py` | Delete endpoint: self-delete guard + last-superuser guard |
| `frontend/src/admin/components/views/UserMgmtView.tsx` | All 10 UX improvements (full rewrite) |
| `SPEC.md` | Iteration 3b section added; User Mgmt view spec updated; API table updated |
| `CLAUDE.md` | Current state updated to Iteration 3b; new conventions documented |
| `WORKBOOK-3b.md` | This file |

---

## Testing Checklist

Work through these manually after running `npm run dev` and `uvicorn`:

### Delete guards
- [ ] Log in as `mike.k` (superuser). Go to User Mgmt. Try to delete your own row → expect error toast "Cannot delete…"
- [ ] Create a second user with role `general-user`. Log back in as `mike.k`. Try to delete `mike.k` → same error.
- [ ] Delete the `general-user` row you just created → succeeds.

### Role dots — display-only
- [ ] Click any role dot in the table → nothing happens (no confirm dialog, no PATCH call).
- [ ] Click a user row → change Role dropdown in form → click Update → row role dot updates.

### Password reset confirm
- [ ] Edit a user. Type a new password (≥ 8 chars). Click Update → confirm dialog appears asking about password reset.
- [ ] Click "Cancel" in the dialog → field changes (email etc.) still save, but password is NOT reset.
- [ ] Click "OK" → password is reset.
- [ ] Edit a user. Leave password blank. Click Update → no password dialog appears.

### Search scope
- [ ] Type a full name fragment (e.g. "alice") in the search box → user with Full Name "Alice Smith" appears even if username doesn't match.
- [ ] Type an email fragment → matching user appears.

### Status filter
- [ ] Suspend a user. Select "Suspended only" from the Status filter → only that user appears.
- [ ] Select "Active only" → suspended user disappears.
- [ ] Clear the filter (✕) → all users reappear.

### Error vs info toasts
- [ ] Successfully create a user → dark toast, dismisses in ~4s.
- [ ] Attempt to delete yourself → red-tinted toast with border, stays ~7s.

### Dirty state guard
- [ ] Click a user row. Change the email field. Click a different row → "Discard and continue?" dialog appears.
- [ ] Click Cancel → stays on current edit.
- [ ] Click OK → switches to new row, previous edit discarded.
- [ ] Edit a field. Click Update successfully → form clears, no dirty warning on next row click.
- [ ] Blue border visible while form is dirty; disappears after clear/save.

### EA busy lock
- [ ] Select a `general-user`. In the EA Access panel, click a tile rapidly twice → only one request fires (panel fades during request).

### Export download
- [ ] Click "Export & Download" → browser downloads `cdags_users.xlsx`.
- [ ] Open the file in Excel/LibreOffice → columns: UID, Username, Full Name, Email, Role, Corporate ID, Active, Created At.
- [ ] Button shows "Exporting…" and is disabled during download.

### Role column + Full Name in EA panel
- [ ] Table has a "Role" column showing short codes (SU, OPR, etc.) — sortable.
- [ ] Select a `general-user` who has a Full Name set → EA panel header shows `username (Full Name)`.
