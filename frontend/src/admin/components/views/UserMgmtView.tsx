import React, { useState, useEffect, useMemo } from 'react';
import {
  UserListItem, UserRole, EaAccessItem, ExpertAgent,
  ALL_ROLES, ROLE_LABELS, ROLE_SHORT,
} from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useUserMgmt } from '../../hooks/useUserMgmt';

const emptyForm = {
  username: '', email: '', password: '', corporate_id: '',
  role: 'general-user' as UserRole,
};
type FormState = typeof emptyForm;
type SortField = 'username' | 'role' | 'is_active';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

const RoleDot: React.FC<{ active: boolean; onClick?: () => void }> = ({ active, onClick }) => (
  <span
    onClick={onClick}
    title={active ? 'Current role' : 'Click to assign this role'}
    style={{
      display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
      backgroundColor: active ? '#00ff88' : '#dc143c',
      cursor: onClick && !active ? 'pointer' : 'default', flexShrink: 0,
    }}
  />
);

const SortArrow: React.FC<{ field: SortField; sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void }> =
  ({ field, sortField, sortDir, onSort }) => (
    <span onClick={() => onSort(field)} style={{ cursor: 'pointer', marginLeft: '4px', fontSize: '10px', opacity: sortField === field ? 1 : 0.35 }}>
      {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

export const UserMgmtView: React.FC = () => {
  const { session } = useAuth();
  const {
    users, loading, error, refetch,
    createUser, updateUser, resetPassword, deleteUser,
    getEaAccess, addEaAccess, removeEaAccess, logAdminAction,
  } = useUserMgmt();

  const [agents, setAgents] = useState<ExpertAgent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [eaAccessList, setEaAccessList] = useState<EaAccessItem[]>([]);
  const [showEaPanel, setShowEaPanel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch('/api/agents/', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.ok ? r.json() : []).then(setAgents).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Filtered + sorted user list
  const displayUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q ? users.filter(u => u.username.toLowerCase().includes(q)) : users;
    return [...filtered].sort((a, b) => {
      let va: string, vb: string;
      if (sortField === 'is_active') { va = a.is_active ? 'a' : 'b'; vb = b.is_active ? 'a' : 'b'; }
      else { va = (a[sortField] as string).toLowerCase(); vb = (b[sortField] as string).toLowerCase(); }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [users, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  if (session?.role !== 'superuser' && session?.role !== 'admin') {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{
          background: 'rgba(220,20,60,0.12)', border: '1px solid #dc143c',
          borderRadius: 'var(--border-radius-lg)', padding: '24px',
          color: '#f87171', fontWeight: 600,
        }}>
          Access Denied — Superuser role required.
        </div>
      </div>
    );
  }

  const clearForm = () => {
    setForm(emptyForm); setSelectedUser(null);
    setFormMode('add'); setShowEaPanel(false); setEaAccessList([]);
  };

  const selectRow = async (user: UserListItem) => {
    setSelectedUser(user); setFormMode('edit');
    setForm({ username: user.username, email: user.email, password: '',
               corporate_id: user.corporate_id ?? '', role: user.role });
    setEaAccessList([]);
    if (user.role === 'general-user') {
      setShowEaPanel(true);
      setEaAccessList(await getEaAccess(user.id));
    } else { setShowEaPanel(false); }
  };

  const validate = (): string | null => {
    if (!form.username.match(/^[a-z]+\.[a-z]\d*$/))
      return 'Username must be lowercase, format: first.l or first.l7';
    if (!form.email.includes('@')) return 'Invalid email address';
    if (formMode === 'add' && form.password.length < 8) return 'Password must be at least 8 characters';
    if (!ALL_ROLES.includes(form.role)) return 'Invalid role selected';
    return null;
  };

  const handleAdd = async () => {
    const err = validate();
    if (err) { setToast(`⚠ ${err}`); return; }
    const result = await createUser({
      username: form.username, email: form.email, password: form.password,
      role: form.role, corporate_id: form.corporate_id || undefined,
    });
    if (result) {
      await logAdminAction(`Superuser "${session?.username}" created user "${form.username}" with role "${form.role}".`);
      setToast(`User "${form.username}" created.`); clearForm();
    } else { setToast('Failed — username or email may already exist.'); }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    const err = validate();
    if (err) { setToast(`⚠ ${err}`); return; }
    const patch: Record<string, unknown> = {};
    if (form.email !== selectedUser.email) patch.email = form.email;
    if (form.role !== selectedUser.role) patch.role = form.role;
    if (form.corporate_id !== (selectedUser.corporate_id ?? '')) patch.corporate_id = form.corporate_id || null;
    if (Object.keys(patch).length > 0) {
      if (!(await updateUser(selectedUser.id, patch))) { setToast('Update failed.'); return; }
    }
    if (form.password.length >= 8) {
      if (!(await resetPassword(selectedUser.id, form.password))) { setToast('Password reset failed.'); return; }
    }
    await logAdminAction(`Superuser "${session?.username}" updated user "${selectedUser.username}".`);
    setToast(`User "${selectedUser.username}" updated.`); clearForm();
  };

  const handleRoleChange = async (user: UserListItem, newRole: UserRole) => {
    if (user.role === newRole) return;
    if (!window.confirm(`Change "${user.username}"'s role to "${ROLE_LABELS[newRole]}"?\nThis will be audit-logged.`)) return;
    const r = await updateUser(user.id, { role: newRole });
    if (r) {
      await logAdminAction(`Superuser "${session?.username}" changed "${user.username}" role from "${user.role}" to "${newRole}".`);
      setToast(`Role updated for "${user.username}".`);
    } else { setToast('Role update failed.'); }
  };

  const handleSuspendToggle = async (user: UserListItem) => {
    const action = user.is_active ? 'suspend' : 'restore';
    if (!window.confirm(`${action === 'suspend' ? 'Suspend' : 'Restore'} user "${user.username}"?\nThis will be audit-logged.`)) return;
    const r = await updateUser(user.id, { is_active: !user.is_active });
    if (r) {
      await logAdminAction(`Superuser "${session?.username}" ${action}d user "${user.username}" (id=${user.id}).`);
      setToast(`"${user.username}" ${action === 'suspend' ? 'suspended' : 'restored'}.`);
    }
  };

  const handleDelete = async (user: UserListItem) => {
    if (!window.confirm(`Permanently delete "${user.username}"?\nThis CANNOT be undone.`)) return;
    if (await deleteUser(user.id)) {
      await logAdminAction(`Superuser "${session?.username}" deleted user "${user.username}" (id=${user.id}).`);
      setToast(`"${user.username}" deleted.`);
      if (selectedUser?.id === user.id) clearForm();
    } else { setToast('Delete failed.'); }
  };

  const handleEaToggle = async (ea: ExpertAgent) => {
    if (!selectedUser) return;
    const has = eaAccessList.some(e => e.expert_agent_id === ea.id);
    if (has) await removeEaAccess(selectedUser.id, ea.id);
    else await addEaAccess(selectedUser.id, ea.id);
    setEaAccessList(await getEaAccess(selectedUser.id));
  };

  // Styles
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-sm)', color: 'var(--text-primary)',
    padding: '6px 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box',
  };
  // Read-only info fields — visually distinct from editable inputs
  const readonlyStyle: React.CSSProperties = {
    ...inputStyle,
    background: '#1a1f2e',       // darker, clearly non-editable
    color: 'var(--text-tertiary)',
    border: '1px solid transparent',
    cursor: 'default',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.4px',
    marginBottom: '4px', display: 'block',
  };
  const readonlyLabelStyle: React.CSSProperties = {
    ...labelStyle, color: '#475569', // even more muted for info-only labels
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>User Management</h2>
        <button onClick={refetch} style={{
          background: 'none', border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-md)', color: 'var(--text-secondary)',
          padding: '6px 14px', cursor: 'pointer', fontSize: '13px',
        }}>Refresh</button>
      </div>

      {/* ── Section 1: Form ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius-lg)', padding: '20px', marginBottom: '24px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {formMode === 'add' ? 'Add New User' : `Editing: ${selectedUser?.username}`}
        </div>

        {/* Row 1: editable fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input style={{ ...inputStyle, opacity: formMode === 'edit' ? 0.6 : 1 }}
              value={form.username} readOnly={formMode === 'edit'}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
              placeholder="first.l" />
            {formMode === 'add' && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>first_name.last_initial</span>}
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com" />
          </div>
          <div>
            <label style={labelStyle}>{formMode === 'add' ? 'Default Password' : 'Reset Password'}</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle, paddingRight: '34px' }}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={formMode === 'edit' ? 'Leave blank to keep' : 'Min 8 characters'} />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', fontSize: '14px', lineHeight: 1, padding: '2px',
                }}
              >{showPassword ? '🙈' : '👁'}</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Corporate ID</label>
            <input style={inputStyle} value={form.corporate_id}
              onChange={e => setForm(f => ({ ...f, corporate_id: e.target.value }))}
              placeholder="Optional" />
          </div>
        </div>

        {/* Row 2: read-only info + role + buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={readonlyLabelStyle}>Date Created <span style={{ fontSize: '9px', letterSpacing: 0 }}>(auto)</span></label>
            <input style={readonlyStyle} readOnly tabIndex={-1}
              value={selectedUser ? formatDate(selectedUser.created_at) : 'Auto-generated'} />
          </div>
          <div>
            <label style={readonlyLabelStyle}>System UID <span style={{ fontSize: '9px', letterSpacing: 0 }}>(auto)</span></label>
            <input style={{ ...readonlyStyle, fontFamily: 'monospace' }} readOnly tabIndex={-1}
              value={selectedUser?.uid ?? 'Auto-generated'} />
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {formMode === 'add' ? (
              <button onClick={handleAdd} style={{
                background: 'var(--active-highlight)', border: 'none',
                borderRadius: 'var(--border-radius-sm)', color: '#fff',
                padding: '7px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              }}>Add User</button>
            ) : (
              <button onClick={handleUpdate} style={{
                background: 'none', border: '1px solid #15803d',
                borderRadius: 'var(--border-radius-sm)', color: '#00ff88',
                padding: '7px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              }}>Update</button>
            )}
            <button onClick={clearForm} style={{
              background: 'none', border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-sm)', color: 'var(--text-secondary)',
              padding: '7px 14px', cursor: 'pointer', fontSize: '13px',
            }}>Clear</button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Search bar + Role Matrix ─────────────────────────────── */}
      {loading && <p style={{ color: 'var(--text-tertiary)' }}>Loading users…</p>}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}

      {!loading && !error && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-lg)', overflow: 'hidden', marginBottom: '24px',
        }}>
          {/* Search bar */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
              Search
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by username…"
              style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-sm)', color: 'var(--text-primary)',
                padding: '5px 10px', fontSize: '13px', width: '220px',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                background: 'none', border: 'none', color: 'var(--text-tertiary)',
                cursor: 'pointer', fontSize: '13px', padding: '2px 6px',
              }}>✕</button>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
              {displayUsers.length} / {users.length} users
            </span>
          </div>

          {/* Scrollable table */}
          <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Username <SortArrow field="username" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th style={{ padding: '9px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>UID</th>
                  <th style={{ padding: '9px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Status <SortArrow field="is_active" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  {ALL_ROLES.map(r => (
                    <th key={r} title={ROLE_LABELS[r]} style={{ padding: '9px 8px', textAlign: 'center', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {ROLE_SHORT[r] ?? r}
                    </th>
                  ))}
                  <th style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.length === 0 && (
                  <tr><td colSpan={ALL_ROLES.length + 4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                    No users match "{search}"
                  </td></tr>
                )}
                {displayUsers.map((user, i) => (
                  <tr key={user.id} onClick={() => selectRow(user)}
                    style={{
                      borderBottom: i < displayUsers.length - 1 ? '1px solid var(--border-color)' : 'none',
                      background: selectedUser?.id === user.id ? 'rgba(59,130,246,0.08)' : 'transparent',
                      cursor: 'pointer',
                    }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{user.username}</td>
                    <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-tertiary)' }}>{user.uid}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: user.is_active ? '#00ff88' : '#ff6a00' }}>
                        {user.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    {ALL_ROLES.map(r => (
                      <td key={r} style={{ padding: '10px 8px', textAlign: 'center' }}
                        onClick={e => { e.stopPropagation(); handleRoleChange(user, r); }}>
                        <RoleDot active={user.role === r}
                          onClick={user.role !== r ? () => handleRoleChange(user, r) : undefined} />
                      </td>
                    ))}
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}
                      onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleSuspendToggle(user)} style={{
                        background: 'none',
                        border: `1px solid ${user.is_active ? '#c2410c' : '#15803d'}`,
                        borderRadius: 'var(--border-radius-sm)',
                        color: user.is_active ? '#ff6a00' : '#00ff88',
                        padding: '3px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, marginRight: '6px',
                      }}>{user.is_active ? 'Suspend' : 'Restore'}</button>
                      <button onClick={() => handleDelete(user)} style={{
                        background: 'none', border: '1px solid #991b1b',
                        borderRadius: 'var(--border-radius-sm)', color: '#ef4444',
                        padding: '3px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                      }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 3: EA Access Panel ───────────────────────────────────────── */}
      {showEaPanel && selectedUser && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-lg)', padding: '20px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px' }}>
            EA Access — <span style={{ color: 'var(--text-primary)' }}>{selectedUser.username}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
              (green = has access · crimson = no access — click to toggle)
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {agents.map(ea => {
              const has = eaAccessList.some(e => e.expert_agent_id === ea.id);
              return (
                <div key={ea.id} onClick={() => handleEaToggle(ea)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', cursor: 'pointer',
                  background: 'var(--bg-tertiary)',
                  border: `1px solid ${has ? '#15803d' : 'var(--border-color)'}`,
                  borderRadius: 'var(--border-radius-md)',
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: ea.color_theme, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>{ea.name}</span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, backgroundColor: has ? '#00ff88' : '#dc143c' }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#f8fafc', padding: '12px 24px',
          borderRadius: 'var(--border-radius-md)', fontSize: '13px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 1000, whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}
    </div>
  );
};
