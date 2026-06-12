import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
          <h2 style={{ marginBottom: '24px', fontWeight: 600 }}>OT Env. Operational Functions as AI-Agents</h2>
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
  // Return login page if not authenticated, else load main framework dashboard
  return session ? <DashboardShell /> : <LoginForm />;
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
