import React, { createContext, useState, useContext } from 'react';
import { UserSession } from '../types';

interface AuthContextType {
  session: UserSession | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(() => {
    const stored = localStorage.getItem('session');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) return false;
      const data = await response.json();
      
      const userSession: UserSession = {
        id: data.id,
        token: data.token,
        username: data.username,
        role: data.role
      };
      
      setSession(userSession);
      localStorage.setItem('session', JSON.stringify(userSession));
      return true;
    } catch (e) {
      console.error("Login failed: ", e);
      return false;
    }
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem('session');
  };

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
