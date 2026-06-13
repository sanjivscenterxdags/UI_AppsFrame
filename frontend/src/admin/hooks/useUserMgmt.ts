import { useState, useEffect, useCallback } from 'react';
import {
  UserListItem, UserCreatePayload, UserUpdatePayload, EaAccessItem,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

export interface UseUserMgmtResult {
  users: UserListItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createUser: (payload: UserCreatePayload) => Promise<UserListItem | null>;
  updateUser: (id: number, payload: UserUpdatePayload) => Promise<UserListItem | null>;
  resetPassword: (id: number, newPassword: string) => Promise<boolean>;
  deleteUser: (id: number) => Promise<boolean>;
  getEaAccess: (userId: number) => Promise<EaAccessItem[]>;
  addEaAccess: (userId: number, expertAgentId: number) => Promise<boolean>;
  removeEaAccess: (userId: number, expertAgentId: number) => Promise<boolean>;
  logAdminAction: (message: string) => Promise<void>;
}

export function useUserMgmt(): UseUserMgmtResult {
  const { session, logout } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeader = (): Record<string, string> =>
    session ? { Authorization: `Bearer ${session.token}` } : {};

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, logout]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = useCallback(async (payload: UserCreatePayload): Promise<UserListItem | null> => {
    try {
      const res = await fetch('/api/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { logout(); return null; }
      if (!res.ok) return null;
      const created: UserListItem = await res.json();
      await fetchUsers();
      return created;
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, logout, fetchUsers]);

  const updateUser = useCallback(async (id: number, payload: UserUpdatePayload): Promise<UserListItem | null> => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { logout(); return null; }
      if (!res.ok) return null;
      const updated: UserListItem = await res.json();
      await fetchUsers();
      return updated;
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, logout, fetchUsers]);

  const resetPassword = useCallback(async (id: number, newPassword: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ new_password: newPassword }),
      });
      if (res.status === 401) { logout(); return false; }
      return res.ok;
    } catch {
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, logout]);

  const deleteUser = useCallback(async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      if (res.status === 401) { logout(); return false; }
      if (res.ok) { await fetchUsers(); }
      return res.ok;
    } catch {
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, logout, fetchUsers]);

  const getEaAccess = useCallback(async (userId: number): Promise<EaAccessItem[]> => {
    try {
      const res = await fetch(`/api/users/${userId}/ea-access`, { headers: authHeader() });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const addEaAccess = useCallback(async (userId: number, expertAgentId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/users/${userId}/ea-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ expert_agent_id: expertAgentId }),
      });
      return res.ok || res.status === 409; // 409 = already exists, treat as ok
    } catch {
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const removeEaAccess = useCallback(async (userId: number, expertAgentId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/users/${userId}/ea-access/${expertAgentId}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      return res.ok;
    } catch {
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

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

  return {
    users, loading, error, refetch: fetchUsers,
    createUser, updateUser, resetPassword, deleteUser,
    getEaAccess, addEaAccess, removeEaAccess, logAdminAction,
  };
}
