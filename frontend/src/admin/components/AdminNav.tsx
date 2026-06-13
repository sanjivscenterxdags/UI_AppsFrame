import React from 'react';
import { AdminNavView } from '../../types';

interface AdminNavProps {
  activeView: AdminNavView;
  onSelect: (view: AdminNavView) => void;
}

const NAV_ITEMS: { label: string; view: AdminNavView }[] = [
  { label: 'User Mgmt.',     view: 'user-mgmt'      },
  { label: 'AI-Agent Mgmt.', view: 'agent-mgmt'     },
  { label: 'Prompt Window',  view: 'prompt-window'  },
  { label: 'Health Status',  view: 'health-status'  },
];

export const AdminNav: React.FC<AdminNavProps> = ({ activeView, onSelect }) => (
  <nav className="admin-nav">
    <div style={{
      textTransform: 'uppercase', fontSize: '11px', fontWeight: 700,
      letterSpacing: '1px', color: 'var(--text-tertiary)',
      marginBottom: '12px', paddingLeft: '12px',
    }}>
      Functions
    </div>
    <ul className="sidebar-list">
      {NAV_ITEMS.map(({ label, view }) => (
        <li
          key={view}
          className={`sidebar-item${activeView === view ? ' active' : ''}`}
          onClick={() => onSelect(view)}
        >
          {label}
        </li>
      ))}
    </ul>
  </nav>
);
