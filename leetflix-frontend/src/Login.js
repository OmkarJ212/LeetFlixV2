import React, { useState } from 'react';
import './Login.css';

function Login({ onLogin, onSignup, onAdminLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignUp) {
      await onSignup(username, password);
    } else {
      await onLogin(username, password);
    }
  };
  
  const handleAdminSubmit = async (e) => {
      e.preventDefault();
      setError('');
      if (!username || !password || !adminKey) {
          setError('All fields are required for admin login.');
          return;
      }
      await onAdminLogin(username, password, adminKey);
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setIsAdminMode(false);
  };
  
  const toggleAdminMode = () => {
      setIsAdminMode(!isAdminMode);
      setIsSignUp(false);
      setError('');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1 className="login-logo">LEETFLIX</h1>
        <h2>{isSignUp ? 'Sign Up' : (isAdminMode ? 'Admin Login' : 'Sign In')}</h2>
        
        {isAdminMode ? (
            <form onSubmit={handleAdminSubmit} className="login-form">
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="login-input"
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                    required
                />
                <input
                    type="password"
                    placeholder="Admin Key"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="login-input"
                    required
                />
                {error && <p className="error-message">{error}</p>}
                <button type="submit" className="login-button admin-login-button">
                    Admin Login
                </button>
            </form>
        ) : (
            <form onSubmit={handleSubmit} className="login-form">
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="login-input"
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                    required
                />
                {error && <p className="error-message">{error}</p>}
                <button type="submit" className="login-button">
                    {isSignUp ? 'Sign Up' : 'Sign In'}
                </button>
            </form>
        )}
        
        <div className="toggle-mode">
            {isAdminMode ? (
                <>
                    <button onClick={toggleAdminMode} className="toggle-button">Cancel Admin Login</button>
                </>
            ) : (
                <>
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                    <button onClick={toggleMode} className="toggle-button">
                        {isSignUp ? 'Sign In here' : 'Register Here'}
                    </button>
                    <button onClick={toggleAdminMode} className="toggle-button admin-toggle-btn">Admin Login</button>
                </>
            )}
        </div>
      </div>
    </div>
  );
}

export default Login;