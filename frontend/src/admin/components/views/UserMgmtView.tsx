import React from 'react';

export const UserMgmtView: React.FC = () => (
  <div>
    <h2 style={{ marginBottom: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
      User Management
    </h2>
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '48px 24px',
      textAlign: 'center',
      color: 'var(--text-tertiary)',
    }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
      <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
        Coming Soon
      </div>
      <div style={{ fontSize: '13px' }}>
        User management endpoints are not yet available. This view will allow creating,
        editing, and deactivating user accounts.
      </div>
    </div>
  </div>
);
