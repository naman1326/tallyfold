import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from './auth';
import { useToast } from './toast';
import { useTheme, type Theme } from './theme';
import { Sun, Moon, Laptop } from 'lucide-react';

function LoginThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { info } = useToast();

  const select = (t: Theme) => {
    setTheme(t);
    info(`Theme: ${t.charAt(0).toUpperCase() + t.slice(1)}`);
  };

  return (
    <div className="segmented-theme" role="radiogroup" aria-label="Theme selector">
      <button
        type="button"
        className={`segmented-item ${theme === 'light' ? 'active' : ''}`}
        onClick={() => select('light')}
        title="Light theme"
        aria-label="Light theme"
      >
        <Sun size={14} />
      </button>
      <button
        type="button"
        className={`segmented-item ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => select('dark')}
        title="Dark theme"
        aria-label="Dark theme"
      >
        <Moon size={14} />
      </button>
      <button
        type="button"
        className={`segmented-item ${theme === 'system' ? 'active' : ''}`}
        onClick={() => select('system')}
        title="System default theme"
        aria-label="System default theme"
      >
        <Laptop size={14} />
      </button>
    </div>
  );
}

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const { login, isAuthenticated } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // If already authenticated, redirect to destination or home
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Simulate authenticating for a smooth Apple transition feel
    setTimeout(() => {
      const result = login(username, password);
      if (result.success) {
        success(`Welcome back, ${username.trim()}!`);
        navigate(from, { replace: true });
      } else {
        const msg = result.error || 'Invalid credentials.';
        setErrorMsg(msg);
        toastError(msg);
        setLoading(false);
      }
    }, 300);
  };



  return (
    <div className="login-screen-wrapper">
      <div className="login-top-bar">
        <Link to="/login" className="brand" aria-label="Tallyfold Home">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
              <linearGradient id="tfLogoGradLogin" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06d6e6" />
                <stop offset="100%" stopColor="#00a8b3" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill="url(#tfLogoGradLogin)" />
            <path d="M9 7h14v18l-3.5-2.5L16 25l-3.5-2.5L9 25z" fill="#02040a" />
            <path d="M12.5 14.5l2.5 2.5 4.5-5" stroke="#06d6e6" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="brand-name">Tallyfold</span>
        </Link>

        <div className="login-top-actions">
          <span className="env page-eyebrow">
            <span className="env-dot pulse" />
            QuickBooks Sandbox
          </span>
          <LoginThemeToggle />
        </div>
      </div>

      <div className="login-center-container">
        <div className="login-card login-panel">
          <div className="laser-beam" />
          <div className="login-header">
            <div className="login-icon-badge">
              <ShieldCheck size={26} strokeWidth={2.2} />
            </div>
            <h2 className="modal-title">Sign in to Tallyfold</h2>
            <p>Access the QuickBooks expense inspection and audit pipeline.</p>
          </div>

          {errorMsg && (
            <div className="login-error-banner" role="alert">
              <AlertCircle size={17} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field-group">
              <label htmlFor="tf-username">Username</label>
              <div className="login-input-wrapper">
                <span className="input-affix-icon">
                  <User size={16} />
                </span>
                <input
                  id="tf-username"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. user"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <div className="login-password-header">
                <label htmlFor="tf-password">Password</label>
              </div>
              <div className="login-input-wrapper">
                <span className="input-affix-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="tf-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  required
                />
                <button
                  type="button"
                  className="input-eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="login-options-row">
              <label className="login-remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>Remember this device</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary login-btn"
              disabled={loading || !username.trim() || !password}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <div className="login-security-tag">
              <span className="env-dot pulse" />
              <span className="mono">TLS 1.3 End-to-End Encrypted Session</span>
            </div>
            <div className="login-copyright mono">
              Tallyfold Financial Systems &copy; 2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
