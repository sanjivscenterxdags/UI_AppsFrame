import React from 'react';
import { useAdminAgents, useHealthStatus } from '../../hooks/useAdminAgents';

export const HealthStatusView: React.FC = () => {
  const { status, loading: healthLoading, error: healthError } = useHealthStatus();
  const { agents, loading: agentsLoading, error: agentsError } = useAdminAgents();

  const backendOk = !healthError && status !== null;

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
        Health Status
      </h2>

      {/* Backend health */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '14px', minWidth: '120px' }}>
          Backend API
        </span>
        {healthLoading ? (
          <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Checking…</span>
        ) : (
          <>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
              backgroundColor: backendOk ? '#34d399' : '#f87171',
            }} />
            <span style={{
              fontSize: '13px', fontWeight: 600,
              color: backendOk ? '#34d399' : '#f87171',
            }}>
              {backendOk ? `OK — ${status}` : 'Unreachable'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
              GET /health
            </span>
          </>
        )}
      </div>

      {/* Expert Agent status table */}
      <h3 style={{ marginBottom: '12px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Expert Agent Status
      </h3>

      {agentsLoading && <p style={{ color: 'var(--text-tertiary)' }}>Loading agents…</p>}
      {agentsError && <p style={{ color: '#f87171' }}>{agentsError}</p>}

      {!agentsLoading && !agentsError && (
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
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Health</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => (
                <tr
                  key={agent.id}
                  style={{ borderBottom: i < agents.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '10px', height: '10px', borderRadius: '2px',
                        backgroundColor: agent.color_theme, flexShrink: 0,
                      }} />
                      <span style={{ color: 'var(--text-primary)' }}>{agent.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                        backgroundColor: agent.is_active ? '#34d399' : '#f87171',
                      }} />
                      <span style={{
                        fontSize: '13px', fontWeight: 600,
                        color: agent.is_active ? '#34d399' : '#f87171',
                      }}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                    Expert Agent
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
