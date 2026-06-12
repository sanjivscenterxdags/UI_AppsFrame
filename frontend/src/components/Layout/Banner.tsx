import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';


export const Banner: React.FC = () => {
  const { session, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [dateTime, setDateTime] = useState(new Date());

  // Keep clock running live in banner
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  return (
    <header className="banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: 'var(--active-highlight)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>D</div>
        <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '0.5px' }}>
          <span style={{ color: '#00f0ff' }}>CDAGS</span> AI-Agents: OT-IT Convergence & Cybersecurity
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          User: <strong>{session?.username}</strong>
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
          {formatDate(dateTime)}
        </span>
        <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button 
          onClick={logout}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--active-highlight)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
};
