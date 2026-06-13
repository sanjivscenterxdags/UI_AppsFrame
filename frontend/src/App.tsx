import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminShell } from './admin/AdminApp';
import { AgentProvider } from './context/AgentContext';
import { LoginForm } from './components/Auth/LoginForm';
import { Banner } from './components/Layout/Banner';
import { Sidebar } from './components/Layout/Sidebar';
import { AgentGrid } from './components/Agent/AgentGrid';
import { LogPanel } from './components/Layout/LogPanel';
import { Footer } from './components/Layout/Footer';
import './styles/global.css';

const DashboardShell: React.FC = () => {
  return (
    <AgentProvider>
      <div className="app-container">
        <Banner />
        <Sidebar />
        <main className="main-content">
          <h2 style={{ marginBottom: '24px', fontWeight: 600 }}><span style={{ color: '#00f0ff' }}>AI-Agents</span>:  OT Operational Functions</h2>
          <AgentGrid />
        </main>
        <LogPanel />
        <Footer />
      </div>
    </AgentProvider>
  );
};

const AuthCheckGate: React.FC = () => {
  const { session } = useAuth();
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!session) return <LoginForm />;
  if (hash === '#admin') return <AdminShell />;
  return <DashboardShell />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthCheckGate />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
