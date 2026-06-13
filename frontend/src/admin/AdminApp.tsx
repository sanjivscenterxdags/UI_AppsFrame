import React, { useState } from 'react';
import { AdminNavView } from '../types';
import { AdminBanner } from './components/AdminBanner';
import { AdminNav } from './components/AdminNav';
import { AdminFooter } from './components/AdminFooter';
import { UserMgmtView } from './components/views/UserMgmtView';
import { AgentMgmtView } from './components/views/AgentMgmtView';
import { PromptWindowView } from './components/views/PromptWindowView';
import { HealthStatusView } from './components/views/HealthStatusView';

export const AdminShell: React.FC = () => {
  const [activeView, setActiveView] = useState<AdminNavView>('health-status');

  const renderView = () => {
    switch (activeView) {
      case 'user-mgmt':      return <UserMgmtView />;
      case 'agent-mgmt':     return <AgentMgmtView />;
      case 'prompt-window':  return <PromptWindowView />;
      case 'health-status':  return <HealthStatusView />;
    }
  };

  return (
    <div className="admin-container">
      <AdminBanner />
      <AdminNav activeView={activeView} onSelect={setActiveView} />
      <main className="admin-main">
        {renderView()}
      </main>
      <AdminFooter />
    </div>
  );
};
