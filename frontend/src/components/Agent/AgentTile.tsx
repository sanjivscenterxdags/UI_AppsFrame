import React from 'react';
import { ExpertAgent } from '../../types';

interface AgentTileProps {
  agent: ExpertAgent;
  isActive: boolean;
  onClick: () => void;
}

export const AgentTile: React.FC<AgentTileProps> = ({ agent, isActive, onClick }) => {
  // Use tile-specific theme colors for the border
  const borderStyle: React.CSSProperties = {
    border: `var(--border-width-thick) solid ${agent.color_theme}`,
    boxShadow: isActive ? `0 0 16px ${agent.color_theme}` : 'none',
    opacity: isActive ? 1 : 0.85,
    transform: isActive ? 'scale(1.02)' : 'none'
  };

  return (
    <div 
      className="agent-tile" 
      style={borderStyle} 
      onClick={onClick}
    >
      <span className="agent-tile-title" style={{ color: 'var(--text-primary)' }}>
        {agent.name}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
        {agent.specific_sub_agents.length} sub-agent{agent.specific_sub_agents.length !== 1 ? 's' : ''}
      </span>
    </div>
  );
};
