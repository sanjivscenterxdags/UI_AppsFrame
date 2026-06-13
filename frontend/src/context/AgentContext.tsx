import React, { createContext, useState, useEffect, useContext } from 'react';
import { ExpertAgent, SystemLog } from '../types';
import { useAuth } from './AuthContext';

interface AgentContextType {
  agents: ExpertAgent[];
  agentsLoading: boolean;
  activeAgentId: number | null;
  logs: SystemLog[];
  selectAgent: (agentId: number) => Promise<void>;
  fetchLogs: () => Promise<void>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, logout } = useAuth();
  const [agents, setAgents] = useState<ExpertAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [activeAgentId, setActiveAgentId] = useState<number | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  const authHeader: Record<string, string> = session ? { 'Authorization': `Bearer ${session.token}` } : {};

  const handleUnauthorized = () => {
    logout();
  };

  // 1. Fetch Expert Agents from backend SQLite
  useEffect(() => {
    fetch('/api/agents/', { headers: authHeader })
      .then(res => {
        if (res.status === 401) { handleUnauthorized(); return []; }
        return res.json();
      })
      .then(data => setAgents(data))
      .catch(err => console.error("Error loading agents: ", err))
      .finally(() => setAgentsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  // 2. Fetch logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs/', { headers: authHeader });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Error loading logs: ", e);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Pause polling when the tab is hidden; resume when it becomes visible again.
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!interval) interval = setInterval(fetchLogs, 2000);
    };
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };

    const onVisibilityChange = () => {
      document.hidden ? stopPolling() : startPolling();
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  // 3. Post select update to backend and refresh local state
  const selectAgent = async (agentId: number) => {
    setActiveAgentId(agentId);
    try {
      await fetch(`/api/agents/${agentId}/select`, {
        method: 'POST',
        headers: authHeader,
      });
      // Fetch fresh logs immediately to show selection in bottom window
      await fetchLogs();
    } catch (e) {
      console.error("Error selecting agent: ", e);
    }
  };

  return (
    <AgentContext.Provider value={{ agents, agentsLoading, activeAgentId, logs, selectAgent, fetchLogs }}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgents = () => {
  const context = useContext(AgentContext);
  if (!context) throw new Error('useAgents must be used within AgentProvider');
  return context;
};
