import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const success = await login(username, password);
    if (!success) {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="login-overlay">
      <form className="login-card" onSubmit={handleSubmit}>
        <div>
          <h2 className="login-title">CDAGS Portal</h2>
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Enter default credentials to access the AI Framework
          </p>
        </div>
        
        {error && (
          <div style={{ color: 'var(--text-primary)', backgroundColor: '#fecaca', padding: '10px', borderRadius: '4px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label>Username</label>
          <input 
            type="text" 
            className="form-input" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input 
            type="password" 
            className="form-input" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="login-btn">Log In</button>
      </form>
    </div>
  );
};
