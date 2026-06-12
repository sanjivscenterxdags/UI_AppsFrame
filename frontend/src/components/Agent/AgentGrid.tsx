import React from 'react';
import { useAgents } from '../../context/AgentContext';
import { AgentTile } from './AgentTile';

export const AgentGrid: React.FC = () => {
  const { agents, agentsLoading, activeAgentId, selectAgent } = useAgents();

  if (agentsLoading) {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading agents…</p>;
  }

  if (agents.length === 0) {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>No active agents found.</p>;
  }

  return (
    <div className="agent-grid">
      {agents.map((agent) => (
        <AgentTile
          key={agent.id}
          agent={agent}
          isActive={activeAgentId === agent.id}
          onClick={() => selectAgent(agent.id)}
        />
      ))}
    </div>
  );
};
