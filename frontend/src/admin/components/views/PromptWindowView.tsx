import React from 'react';

export const PromptWindowView: React.FC = () => (
  <div>
    <h2 style={{ marginBottom: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
      Prompt Window
    </h2>
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '24px',
    }}>
      <textarea
        className="form-input"
        rows={8}
        placeholder="Enter a prompt to send to the active Expert Agent…"
        style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
        readOnly
      />
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="login-btn" style={{ width: 'auto', padding: '10px 28px' }} disabled>
          Send
        </button>
      </div>
      <div style={{
        marginTop: '20px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: '13px',
      }}>
        Coming Soon — orchestrator endpoint not yet available.
      </div>
    </div>
  </div>
);
