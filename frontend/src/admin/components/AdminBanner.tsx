import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ViewMode, AdminNavView } from '../../types';

interface AdminBannerProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeView: AdminNavView;
}

export const AdminBanner: React.FC<AdminBannerProps> = ({ viewMode, setViewMode, activeView }) => {
  const toggleDisabled = activeView === 'user-mgmt' || activeView === 'prompt-window';
  const { session, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  return (
    <header className="admin-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          backgroundColor: 'var(--active-highlight)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          color: 'white', fontWeight: 'bold', fontSize: '14px', flexShrink: 0,
        }}>D</div>
        <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '0.3px' }}>
          <span style={{ color: '#00f0ff' }}>CDAGS</span>: OT Assets — Mgmt. &amp; Security
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          User: <strong>{session?.username}</strong>
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
          {formatDate(dateTime)}
        </span>
        <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Grid / Tile view toggle — disabled for views that don't support it */}
        <div
          title={toggleDisabled ? 'Grid/Tile toggle not available for this view' : undefined}
          style={{ display: 'flex', border: `1px solid ${toggleDisabled ? 'var(--border-color)' : 'var(--border-color)'}`, borderRadius: '6px', overflow: 'hidden', opacity: toggleDisabled ? 0.35 : 1 }}>
          {(['grid', 'tile'] as const).map((mode) => (
            <button
              key={mode}
              disabled={toggleDisabled}
              onClick={() => !toggleDisabled && setViewMode(mode)}
              style={{
                padding: '5px 14px',
                border: 'none',
                cursor: toggleDisabled ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                background: (!toggleDisabled && viewMode === mode) ? 'var(--active-highlight)' : 'var(--bg-primary)',
                color: (!toggleDisabled && viewMode === mode) ? '#ffffff' : 'var(--text-tertiary)',
                transition: 'background var(--transition-speed), color var(--transition-speed)',
              }}
            >
              {mode === 'grid' ? 'Grid' : 'Tile'}
            </button>
          ))}
        </div>

        <button
          onClick={() => { window.location.hash = ''; }}
          style={{
            background: 'none', border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-sm)',
            color: 'var(--text-secondary)', padding: '4px 12px',
            cursor: 'pointer', fontSize: '13px', fontWeight: 500,
          }}
        >
          ← Dashboard
        </button>
        <button
          onClick={logout}
          style={{
            background: 'none', border: 'none',
            color: 'var(--active-highlight)',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
};
