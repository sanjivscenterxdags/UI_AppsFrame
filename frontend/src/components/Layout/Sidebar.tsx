import React from 'react';
import { useAgents } from '../../context/AgentContext';

export const Sidebar: React.FC = () => {
  const { agents, agentsLoading, activeAgentId, selectAgent } = useAgents();

  return (
    <aside className="sidebar">
      <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '16px', letterSpacing: '1px' }}>
        AI Expert Applications
      </h3>
      {agentsLoading && (
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Loading…</p>
      )}
      {!agentsLoading && agents.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No agents available.</p>
      )}
      <ul className="sidebar-list">
        {agents.map((agent) => (
          <li
            key={agent.id}
            onClick={() => selectAgent(agent.id)}
            className={`sidebar-item ${activeAgentId === agent.id ? 'active' : ''}`}
          >
            {agent.name}
          </li>
        ))}
      </ul>
    </aside>
  );
};
