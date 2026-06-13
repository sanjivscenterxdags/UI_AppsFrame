import React, { useState, useEffect } from 'react';
import { ExpertAgent, ViewMode } from '../../../types';
import { useAdminAgents } from '../../hooks/useAdminAgents';
import { useAuth } from '../../../context/AuthContext';

interface AgentMgmtViewProps {
  viewMode: ViewMode;
}

export const AgentMgmtView: React.FC<AgentMgmtViewProps> = ({ viewMode }) => {
  const { session } = useAuth();
  const { agents, loading, error, refetch, logAdminAction } = useAdminAgents();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => setToast(msg);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToggle = async (agent: ExpertAgent) => {
    const action = agent.is_active ? 'Deactivate' : 'Activate';
    const confirmed = window.confirm(
      `${action} "${agent.name}"?\n\nThis action will be recorded in the audit log.`
    );
    if (!confirmed) return;

    await logAdminAction(
      `Admin "${session?.username}" attempted to ${action.toLowerCase()} agent "${agent.name}" (id=${agent.id}).`
    );
    showToast('Toggle not yet implemented — no backend endpoint available. Action logged.');
  };

  const actionButtonStyle = (isActive: boolean): React.CSSProperties => ({
    background: 'none',
    border: `1px solid ${isActive ? '#c2410c' : '#15803d'}`,
    borderRadius: 'var(--border-radius-sm)',
    color: isActive ? '#ff6a00' : '#00ff88',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  });

  const actionButtonTileStyle = (isActive: boolean): React.CSSProperties => ({
    marginTop: '10px',
    background: 'none',
    border: `1px solid ${isActive ? '#c2410c' : '#15803d'}`,
    borderRadius: 'var(--border-radius-sm)',
    color: isActive ? '#ff6a00' : '#00ff88',
    padding: '3px 10px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>AI-Agent Management</h2>
        <button
          onClick={refetch}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-md)',
            color: 'var(--text-secondary)',
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Refresh
        </button>
      </div>

      {loading && <p style={{ color: 'var(--text-tertiary)' }}>Loading agents…</p>}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}

      {!loading && !error && viewMode === 'grid' && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SAG Sub-Agents</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => (
                <tr key={agent.id} style={{ borderBottom: i < agents.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: agent.color_theme, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{agent.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
                      fontSize: '12px', fontWeight: 600,
                      background: agent.is_active ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                      color: agent.is_active ? '#34d399' : '#f87171',
                    }}>
                      {agent.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                    {agent.specific_sub_agents.length > 0 ? agent.specific_sub_agents.map(s => s.name).join(', ') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggle(agent)}
                      style={actionButtonStyle(agent.is_active)}
                    >
                      {agent.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && viewMode === 'tile' && (
        <div className="agent-grid-tile">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="agent-tile"
              style={{ border: `3px solid ${agent.color_theme}` }}
            >
              <span className="agent-tile-title" style={{ color: 'var(--text-primary)' }}>
                {agent.name}
              </span>
              <span style={{
                display: 'inline-block', marginTop: '8px', padding: '2px 10px',
                borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                background: agent.is_active ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                color: agent.is_active ? '#34d399' : '#f87171',
              }}>
                {agent.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => handleToggle(agent)}
                style={actionButtonTileStyle(agent.is_active)}
              >
                {agent.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#f8fafc', padding: '12px 24px',
          borderRadius: 'var(--border-radius-md)', fontSize: '13px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 1000, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
};
