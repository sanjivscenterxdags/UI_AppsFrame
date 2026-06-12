import React, { useEffect, useRef } from 'react';
import { useAgents } from '../../context/AgentContext';

const LOG_LEVEL_COLOR: Record<string, string> = {
  SUCCESS: 'var(--log-info)',
  INFO:    'var(--log-text)',
  DEBUG:   'var(--text-tertiary)',
  WARNING: '#fbbf24',
  ERROR:   '#f87171',
};

export const LogPanel: React.FC = () => {
  const { logs } = useAgents();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll window to display newest updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    } catch {
      return "00:00:00";
    }
  };

  return (
    <div className="log-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '8px' }}>
        <span style={{ fontWeight: 600, color: 'var(--log-time)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
          Console Monitor Window
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          Polling active (2s interval)
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {[...logs].reverse().map((log) => (
          <div key={log.id} style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--log-time)' }}>[{formatTime(log.created_at)}]</span>
            <span style={{ color: LOG_LEVEL_COLOR[log.level] ?? 'var(--log-text)' }}>
              <strong>{log.source}:</strong> {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
