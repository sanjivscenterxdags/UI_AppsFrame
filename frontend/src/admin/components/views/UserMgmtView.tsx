import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserListItem, UserRole, EaAccessItem, ExpertAgent,
  ALL_ROLES, ROLE_LABELS, ROLE_SHORT,
} from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useUserMgmt } from '../../hooks/useUserMgmt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
const emptyForm = {
  username: '', full_name: '', email: '', password: '', corporate_id: '',
  role: 'general-user' as UserRole,
};
type FormState = typeof emptyForm;
type SortField = 'username' | 'role' | 'is_active';
type SortDir   = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

const RoleDot: React.FC<{ active: boolean; disabled?: boolean }> = ({ active, disabled }) => (
  <span
    title={active ? 'Current role (read-only — use form to change)' : disabled ? '' : ''}
    style={{
      display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
      backgroundColor: active ? '#00ff88' : '#dc143c',
      cursor: 'default', flexShrink: 0,
    }}
  />
);

const SortArrow: React.FC<{
  field: SortField; sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void;
}> = ({ field, sortField, sortDir, onSort }) => (
  <span
    onClick={() => onSort(field)}
    style={{ cursor: 'pointer', marginLeft: 4, fontSize: 10, opacity: sortField === field ? 1 : 0.35 }}
  >
    {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
);

// Toast colours: default = info (dark), error = red-tinted
const Toast: React.FC<{ msg: string; isError?: boolean }> = ({ msg, isError }) => (
  <div style={{
    position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
    background: isError ? '#3b0a0a' : '#1e293b',
    border: `1px solid ${isError ? '#dc143c' : 'transparent'}`,
    color: isError ? '#fca5a5' : '#f8fafc',
    padding: '12px 24px', borderRadius: 'var(--border-radius-md)',
    fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    zIndex: 1000, whiteSpace: 'nowrap', maxWidth: '90vw',
    overflow: 'hidden', textOverflow: 'ellipsis',
  }}>{msg}</div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const UserMgmtView: React.FC = () => {
  const { session } = useAuth();
  const {
    users, loading, error, refetch,
    createUser, updateUser, resetPassword, deleteUser,
    getEaAccess, addEaAccess, removeEaAccess,
    iamLookup, logAdminAction,
  } = useUserMgmt();

  // ── State ────────────────────────────────────────────────────────────────
  const [agents,       setAgents]       = useState<ExpertAgent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [formMode,     setFormMode]     = useState<'add' | 'edit'>('add');
  const [form,         setForm]         = useState<FormState>(emptyForm);
  const [isDirty,      setIsDirty]      = useState(false);
  const [eaAccessList, setEaAccessList] = useState<EaAccessItem[]>([]);
  const [eaBusy,       setEaBusy]       = useState(false);
  const [showEaPanel,  setShowEaPanel]  = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; isError: boolean } | null>(null);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'suspended'>('');
  const [sortField,    setSortField]    = useState<SortField>('username');
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');
  const [showPassword, setShowPassword] = useState(false);
  const [iamBusy,      setIamBusy]      = useState(false);
  const [exportBusy,   setExportBusy]   = useState(false);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    fetch('/api/agents/', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.ok ? r.json() : []).then(setAgents).catch(() => {});
  }, [session]);

  // Toast auto-dismiss (errors stay 7s, info 4s)
  useEffect(() => {
    if (!toast) return;
    const ms = toast.isError ? 7000 : 4000;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast]);

  const showInfo  = (msg: string) => setToast({ msg, isError: false });
  const showError = (msg: string) => setToast({ msg, isError: true });

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const displayUsers = useMemo(() => {
    // Search covers username, full_name, and email
    const q = search.toLowerCase().trim();
    let list = q
      ? users.filter(u =>
          u.username.toLowerCase().includes(q) ||
          (u.full_name ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        )
      : users;
    if (roleFilter)   list = list.filter(u => u.role === roleFilter);
    if (statusFilter) list = list.filter(u => statusFilter === 'active' ? u.is_active : !u.is_active);
    return [...list].sort((a, b) => {
      let va: string, vb: string;
      if (sortField === 'is_active') { va = a.is_active ? 'a' : 'b'; vb = b.is_active ? 'a' : 'b'; }
      else { va = (a[sortField] as string).toLowerCase(); vb = (b[sortField] as string).toLowerCase(); }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [users, search, roleFilter, statusFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // ── Access guard ─────────────────────────────────────────────────────────
  if (session?.role !== 'superuser' && session?.role !== 'admin') {
    return (
      <div style={{ padding: 32 }}>
        <div style={{
          background: 'rgba(220,20,60,0.12)', border: '1px solid #dc143c',
          borderRadius: 'var(--border-radius-lg)', padding: 24,
          color: '#f87171', fontWeight: 600,
        }}>
          Access Denied — Superuser role required.
        </div>
      </div>
    );
  }

  // ── Form helpers ─────────────────────────────────────────────────────────
  const clearForm = () => {
    setForm(emptyForm); setSelectedUser(null);
    setFormMode('add'); setShowEaPanel(false); setEaAccessList([]);
    setIsDirty(false); setShowPassword(false);
  };

  const confirmDiscardIfDirty = (): boolean => {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Discard and continue?');
  };

  const selectRow = async (user: UserListItem) => {
    if (!confirmDiscardIfDirty()) return;
    setSelectedUser(user); setFormMode('edit');
    setForm({
      username:     user.username,
      full_name:    user.full_name ?? '',
      email:        user.email,
      password:     '',
      corporate_id: user.corporate_id ?? '',
      role:         user.role,
    });
    setIsDirty(false); setEaAccessList([]);
    if (user.role === 'general-user') {
      setShowEaPanel(true);
      setEaAccessList(await getEaAccess(user.id));
    } else {
      setShowEaPanel(false);
    }
  };

  const setField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => ({ ...f, [key]: val }));
    setIsDirty(true);
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!form.username.match(/^[a-z]+\.[a-z]\d*$/))
      return 'Username must be lowercase: first.l or first.l7';
    if (!form.email.includes('@')) return 'Invalid email address';
    if (formMode === 'add' && form.password.length < 8)
      return 'Password must be at least 8 characters';
    if (!ALL_ROLES.includes(form.role)) return 'Invalid role selected';
    return null;
  };

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const err = validate();
    if (err) { showError(`⚠ ${err}`); return; }
    const result = await createUser({
      username:     form.username,
      email:        form.email,
      password:     form.password,
      role:         form.role,
      full_name:    form.full_name    || undefined,
      corporate_id: form.corporate_id || undefined,
    });
    if (result) {
      await logAdminAction(`Superuser "${session?.username}" created user "${form.username}" with role "${form.role}".`);
      showInfo(`User "${form.username}" created.`);
      clearForm();
    } else {
      showError('Failed — username or email may already exist.');
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    const err = validate();
    if (err) { showError(`⚠ ${err}`); return; }

    const patch: Record<string, unknown> = {};
    if (form.email        !== selectedUser.email)               patch.email        = form.email;
    if (form.role         !== selectedUser.role)                patch.role         = form.role;
    if (form.full_name    !== (selectedUser.full_name    ?? '')) patch.full_name    = form.full_name    || null;
    if (form.corporate_id !== (selectedUser.corporate_id ?? '')) patch.corporate_id = form.corporate_id || null;

    if (Object.keys(patch).length > 0) {
      if (!(await updateUser(selectedUser.id, patch))) {
        showError('Update failed — check backend logs.'); return;
      }
    }

    // Password reset is explicit — only when 8+ chars typed AND superuser confirms
    if (form.password.length >= 8) {
      if (!window.confirm(`Also reset password for "${selectedUser.username}"?\nThis takes effect immediately.`)) {
        // user said no — proceed with field update only, no password change
      } else {
        if (!(await resetPassword(selectedUser.id, form.password))) {
          showError('Password reset failed.'); return;
        }
      }
    }

    await logAdminAction(`Superuser "${session?.username}" updated user "${selectedUser.username}".`);
    showInfo(`"${selectedUser.username}" updated.`);
    clearForm();
  };

  const handleSuspendToggle = async (user: UserListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const action = user.is_active ? 'suspend' : 'restore';
    if (!window.confirm(`${action === 'suspend' ? 'Suspend' : 'Restore'} user "${user.username}"?\nThis will be audit-logged.`)) return;
    const r = await updateUser(user.id, { is_active: !user.is_active });
    if (r) {
      await logAdminAction(`Superuser "${session?.username}" ${action}d user "${user.username}" (id=${user.id}).`);
      showInfo(`"${user.username}" ${action === 'suspend' ? 'suspended' : 'restored'}.`);
    } else {
      showError(`Failed to ${action} "${user.username}".`);
    }
  };

  const handleDelete = async (user: UserListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete "${user.username}"?\nThis CANNOT be undone and will be audit-logged.`)) return;
    const ok = await deleteUser(user.id);
    if (ok) {
      await logAdminAction(`Superuser "${session?.username}" deleted user "${user.username}" (id=${user.id}).`);
      showInfo(`"${user.username}" deleted.`);
      if (selectedUser?.id === user.id) clearForm();
    } else {
      // Backend returns 400 for self-delete or last-superuser
      showError(`Cannot delete "${user.username}" — you may be deleting yourself or the last superuser.`);
    }
  };

  // EA access — with busy state to prevent double-click races
  const handleEaToggle = async (ea: ExpertAgent) => {
    if (!selectedUser || eaBusy) return;
    setEaBusy(true);
    const has = eaAccessList.some(e => e.expert_agent_id === ea.id);
    if (has) await removeEaAccess(selectedUser.id, ea.id);
    else     await addEaAccess(selectedUser.id, ea.id);
    setEaAccessList(await getEaAccess(selectedUser.id));
    setEaBusy(false);
  };

  // Export — triggers browser download
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

  const handleIamLookup = async () => {
    if (!form.email) { showError('⚠ Enter an email address first'); return; }
    setIamBusy(true);
    const result = await iamLookup(form.email);
    setIamBusy(false);
    if (!result) {
      showError('IAM lookup failed — directory not configured or email not found');
      return;
    }
    setForm(f => ({
      ...f,
      corporate_id: result.corporate_id || f.corporate_id,
      full_name:    result.display_name  || f.full_name,
    }));
    setIsDirty(true);
    showInfo('✓ Corporate ID (and name) populated from IAM directory');
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-sm)', color: 'var(--text-primary)',
    padding: '6px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
  };
  const readonlyStyle: React.CSSProperties = {
    ...inputStyle, background: '#1a1f2e',
    color: 'var(--text-tertiary)', border: '1px solid transparent', cursor: 'default',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.4px',
    marginBottom: 4, display: 'block',
  };
  const readonlyLabelStyle: React.CSSProperties = { ...labelStyle, color: '#475569' };
  const ghostBtn: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-md)', color: 'var(--text-secondary)',
    padding: '6px 14px', cursor: 'pointer', fontSize: 13,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>User Management</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} disabled={exportBusy} style={{ ...ghostBtn, opacity: exportBusy ? 0.5 : 1 }}>
            {exportBusy ? 'Exporting…' : 'Export & Download'}
          </button>
          <button onClick={refetch} style={ghostBtn}>Refresh</button>
        </div>
      </div>

      {/* ── Section 1: Form ────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', border: `1px solid ${isDirty ? 'rgba(59,130,246,0.4)' : 'var(--border-color)'}`,
        borderRadius: 'var(--border-radius-lg)', padding: 20, marginBottom: 24,
        transition: 'border-color 0.2s',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{formMode === 'add' ? 'Add New User' : `Editing: ${selectedUser?.username}`}</span>
          {isDirty && <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 400 }}>● unsaved changes</span>}
        </div>

        {/* Row 1: Username | Full Name | Email | Password */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={{ ...inputStyle, opacity: formMode === 'edit' ? 0.6 : 1 }}
              value={form.username}
              readOnly={formMode === 'edit'}
              onChange={e => setField('username', e.target.value.toLowerCase())}
              placeholder="first.l"
            />
            {formMode === 'add' && (
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>first_name.last_initial</span>
            )}
          </div>

          <div>
            <label style={labelStyle}>Full Name</label>
            <input
              style={inputStyle}
              value={form.full_name}
              onChange={e => setField('full_name', e.target.value)}
              placeholder="Alice Smith"
            />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label style={labelStyle}>{formMode === 'add' ? 'Default Password' : 'Reset Password'}</label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 34 }}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setField('password', e.target.value)}
                placeholder={formMode === 'edit' ? 'Leave blank to keep current' : 'Min 8 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? 'Hide' : 'Show'}
                style={{
                  position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: showPassword ? 'var(--active-highlight)' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Corporate ID + Lookup | Date Created | System UID | Role | Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.5fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Corporate ID</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={form.corporate_id}
                onChange={e => setField('corporate_id', e.target.value)}
                placeholder="Optional — or use Lookup"
              />
              <button
                type="button"
                onClick={handleIamLookup}
                disabled={iamBusy}
                title="Look up corporate ID from FreeIPA / Keycloak LDAP"
                style={{
                  background: 'none', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-sm)', color: 'var(--text-secondary)',
                  padding: '6px 10px', cursor: iamBusy ? 'wait' : 'pointer',
                  fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0,
                  opacity: iamBusy ? 0.5 : 1,
                }}
              >{iamBusy ? '…' : '🔍 Lookup'}</button>
            </div>
          </div>

          <div>
            <label style={readonlyLabelStyle}>Date Created <span style={{ fontSize: 9, letterSpacing: 0 }}>(auto)</span></label>
            <input style={readonlyStyle} readOnly tabIndex={-1}
              value={selectedUser ? formatDate(selectedUser.created_at) : 'Auto-generated'} />
          </div>

          <div>
            <label style={readonlyLabelStyle}>System UID <span style={{ fontSize: 9, letterSpacing: 0 }}>(auto)</span></label>
            <input style={{ ...readonlyStyle, fontFamily: 'monospace' }} readOnly tabIndex={-1}
              value={selectedUser?.uid ?? 'Auto-generated'} />
          </div>

          <div>
            <label style={labelStyle}>Role</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.role}
              onChange={e => setField('role', e.target.value as UserRole)}
            >
              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {formMode === 'add' ? (
              <button onClick={handleAdd} style={{
                background: 'var(--active-highlight)', border: 'none',
                borderRadius: 'var(--border-radius-sm)', color: '#fff',
                padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Add User</button>
            ) : (
              <button onClick={handleUpdate} style={{
                background: 'none', border: '1px solid #15803d',
                borderRadius: 'var(--border-radius-sm)', color: '#00ff88',
                padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Update</button>
            )}
            <button onClick={() => { if (confirmDiscardIfDirty()) clearForm(); }} style={{
              background: 'none', border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-sm)', color: 'var(--text-secondary)',
              padding: '7px 14px', cursor: 'pointer', fontSize: 13,
            }}>Clear</button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Search / Filter + Role Matrix Table ──────────────────── */}
      {loading && <p style={{ color: 'var(--text-tertiary)' }}>Loading users…</p>}
      {error   && <p style={{ color: '#f87171' }}>{error}</p>}

      {!loading && !error && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-lg)', overflow: 'hidden', marginBottom: 24,
        }}>
          {/* Filter bar */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search — covers username, full name, email */}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, username, or email…"
              style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-sm)', color: 'var(--text-primary)',
                padding: '5px 10px', fontSize: 13, width: 220,
              }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>}

            <span style={{ width: 1, height: 20, background: 'var(--border-color)', flexShrink: 0 }} />

            {/* Role filter */}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Role</span>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-sm)', color: roleFilter ? 'var(--text-primary)' : 'var(--text-tertiary)',
                padding: '5px 8px', fontSize: 13, cursor: 'pointer', minWidth: 130,
              }}
            >
              <option value="">All roles</option>
              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_SHORT[r] ?? r} — {ROLE_LABELS[r]}</option>)}
            </select>
            {roleFilter && <button onClick={() => setRoleFilter('')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>}

            <span style={{ width: 1, height: 20, background: 'var(--border-color)', flexShrink: 0 }} />

            {/* Status filter */}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Status</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as '' | 'active' | 'suspended')}
              style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-sm)', color: statusFilter ? 'var(--text-primary)' : 'var(--text-tertiary)',
                padding: '5px 8px', fontSize: 13, cursor: 'pointer', minWidth: 110,
              }}
            >
              <option value="">All</option>
              <option value="active">Active only</option>
              <option value="suspended">Suspended only</option>
            </select>
            {statusFilter && <button onClick={() => setStatusFilter('')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>}

            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
              {displayUsers.length} / {users.length} users
            </span>
          </div>

          {/* Scrollable table */}
          <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Username <SortArrow field="username" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th style={{ padding: '9px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Full Name</th>
                  <th style={{ padding: '9px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>UID</th>
                  <th style={{ padding: '9px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Status <SortArrow field="is_active" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th style={{ padding: '9px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Role <SortArrow field="role" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  {ALL_ROLES.map(r => (
                    <th key={r} title={`${ROLE_LABELS[r]} — read-only, click row to edit`}
                      style={{ padding: '9px 8px', textAlign: 'center', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {ROLE_SHORT[r] ?? r}
                    </th>
                  ))}
                  <th style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.length === 0 && (
                  <tr><td colSpan={ALL_ROLES.length + 6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    No users match the current filters
                  </td></tr>
                )}
                {displayUsers.map((user, i) => (
                  <tr
                    key={user.id}
                    onClick={() => selectRow(user)}
                    style={{
                      borderBottom: i < displayUsers.length - 1 ? '1px solid var(--border-color)' : 'none',
                      background: selectedUser?.id === user.id ? 'rgba(59,130,246,0.08)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{user.username}</td>
                    <td style={{ padding: '10px 10px', color: user.full_name ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 13 }}>
                      {user.full_name ?? '—'}
                    </td>
                    <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)' }}>{user.uid}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: user.is_active ? '#00ff88' : '#ff6a00' }}>
                        {user.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {ROLE_SHORT[user.role] ?? user.role}
                    </td>
                    {/* Role dots — display-only; role changes go through the form */}
                    {ALL_ROLES.map(r => (
                      <td key={r} style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <RoleDot active={user.role === r} />
                      </td>
                    ))}
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}
                      onClick={e => e.stopPropagation()}>
                      <button onClick={e => handleSuspendToggle(user, e)} style={{
                        background: 'none',
                        border: `1px solid ${user.is_active ? '#c2410c' : '#15803d'}`,
                        borderRadius: 'var(--border-radius-sm)',
                        color: user.is_active ? '#ff6a00' : '#00ff88',
                        padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, marginRight: 6,
                      }}>{user.is_active ? 'Suspend' : 'Restore'}</button>
                      <button onClick={e => handleDelete(user, e)} style={{
                        background: 'none', border: '1px solid #991b1b',
                        borderRadius: 'var(--border-radius-sm)', color: '#ef4444',
                        padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 3: EA Access Panel ──────────────────────────────────────── */}
      {showEaPanel && selectedUser && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-lg)', padding: 20,
          opacity: eaBusy ? 0.6 : 1, transition: 'opacity 0.15s',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>
            EA Access — <span style={{ color: 'var(--text-primary)' }}>{selectedUser.username}</span>
            {selectedUser.full_name && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>({selectedUser.full_name})</span>}
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              green = access granted · crimson = no access — click to toggle
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {agents.map(ea => {
              const has = eaAccessList.some(e => e.expert_agent_id === ea.id);
              return (
                <div key={ea.id} onClick={() => handleEaToggle(ea)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', cursor: eaBusy ? 'wait' : 'pointer',
                  background: 'var(--bg-tertiary)',
                  border: `1px solid ${has ? '#15803d' : 'var(--border-color)'}`,
                  borderRadius: 'var(--border-radius-md)',
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: ea.color_theme, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{ea.name}</span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, backgroundColor: has ? '#00ff88' : '#dc143c' }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} isError={toast.isError} />}
    </div>
  );
};
