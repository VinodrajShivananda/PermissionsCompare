import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSalesforce } from '../auth/SalesforceContext';
import { SF_LOGIN_URLS } from '../config';

export function LoginPage() {
  const { login, session, isLoading, error, clearError } = useSalesforce();
  const [loginUrl, setLoginUrl] = useState<string>(SF_LOGIN_URLS.production);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && session) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    clearError();
    setLocalError(null);
    setSubmitting(true);

    try {
      if (!username || !password) {
        throw new Error('Username and password are required.');
      }

      await login(username, password, loginUrl);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError ?? error;

  if (isLoading) {
    return (
      <div className="app">
        <div className="login-page">
          <div className="login-card">
            <div className="loading-spinner">Restoring session...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="login-page">
        <div className="login-card">
          <div className="login-icon">⚡</div>
          <h1>SF Permission Compare</h1>
          <p className="subtitle">Connect to any Salesforce org to compare permissions</p>

          <div className="form-group">
            <label htmlFor="environment">Environment</label>
            <select
              id="environment"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
            >
              <option value={SF_LOGIN_URLS.production}>Production / Developer</option>
              <option value={SF_LOGIN_URLS.sandbox}>Sandbox</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password + Security Token</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="passwordSecurityToken"
              autoComplete="current-password"
            />
          </div>

          <p className="hint">
            Append your security token to your password (e.g. MyPass123TOKEN456)
          </p>

          {displayError && <div className="login-error">{displayError}</div>}

          <button
            type="button"
            className="btn-primary btn-full"
            onClick={handleLogin}
            disabled={submitting}
          >
            {submitting ? 'Connecting...' : 'Connect to Salesforce'}
          </button>

          <div className="setup-help">
            <h3>How this works</h3>
            <p>
              Authentication uses the same SOAP login flow as the SF Dependency Analyzer.
              Your credentials are sent to the local backend, which logs into Salesforce and
              proxies API calls. No Connected App or browser scripts are required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
