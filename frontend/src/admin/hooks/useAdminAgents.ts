import { useState, useEffect, useCallback } from 'react';
import { ExpertAgent } from '../../types';
import { useAuth } from '../../context/AuthContext';

export interface UseAdminAgentsResult {
  agents: ExpertAgent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminAgents(): UseAdminAgentsResult {
  const { session, logout } = useAuth();
  const [agents, setAgents] = useState<ExpertAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agents/', {
        headers: session ? { Authorization: `Bearer ${session.token}` } : {},
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { setError(`Server error: ${res.status}`); return; }
      const data: ExpertAgent[] = await res.json();
      setAgents(data);
    } catch {
      setError('Could not reach the backend.');
    } finally {
      setLoading(false);
    }
  }, [session, logout]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  return { agents, loading, error, refetch: fetchAgents };
}

export interface UseHealthStatusResult {
  status: string | null;
  loading: boolean;
  error: string | null;
}

export function useHealthStatus(): UseHealthStatusResult {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => setStatus(data.status ?? 'ok'))
      .catch(() => setError('Unreachable'))
      .finally(() => setLoading(false));
  }, []);

  return { status, loading, error };
}
