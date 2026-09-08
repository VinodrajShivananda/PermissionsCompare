import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SalesforceClient } from '../api/salesforceClient';
import { describeGlobal, enrichSession, soapLogin } from '../api/salesforceApi';
import { clearSession, loadSession, saveSession } from '../auth/session';
import type { SalesforceSession } from '../types/permissions';

interface SalesforceContextValue {
  session: SalesforceSession | null;
  client: SalesforceClient | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string, loginUrl: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const SalesforceContext = createContext<SalesforceContextValue | null>(null);

export function SalesforceProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SalesforceSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function restoreSession() {
      const saved = loadSession();
      if (!saved) {
        setIsLoading(false);
        return;
      }

      try {
        const validation = await describeGlobal(saved.accessToken, saved.instanceUrl);
        if (validation.error || validation.errorCode) {
          clearSession();
          setError('Session expired. Please sign in again.');
        } else {
          setSession(saved);
        }
      } catch {
        clearSession();
        setError('Could not restore session. Please sign in again.');
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = useCallback(async (username: string, password: string, loginUrl: string) => {
    setError(null);
    const loginResponse = await soapLogin(username, password, loginUrl);

    const now = new Date().toISOString();
    const fallbackSession: SalesforceSession = {
      id: `${loginResponse.orgId ?? 'org'}:${loginResponse.userId ?? 'user'}`,
      accessToken: loginResponse.accessToken,
      instanceUrl: loginResponse.instanceUrl,
      userId: loginResponse.userId ?? '',
      orgId: loginResponse.orgId ?? '',
      username: loginResponse.username ?? '',
      displayName: loginResponse.username ?? 'Salesforce User',
      orgName: loginResponse.instanceUrl.replace('https://', ''),
      isSandbox: loginUrl.includes('test.salesforce.com'),
      authorizedAt: now,
      lastUsedAt: now,
    };

    try {
      const enriched = await enrichSession(loginResponse);
      saveSession(enriched);
      setSession(enriched);
    } catch {
      saveSession(fallbackSession);
      setSession(fallbackSession);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    fetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const client = useMemo(
    () => (session ? new SalesforceClient(session) : null),
    [session],
  );

  const value = useMemo(
    () => ({
      session,
      client,
      isLoading,
      error,
      login,
      logout,
      clearError,
    }),
    [session, client, isLoading, error, login, logout, clearError],
  );

  return (
    <SalesforceContext.Provider value={value}>
      {children}
    </SalesforceContext.Provider>
  );
}

export function useSalesforce() {
  const context = useContext(SalesforceContext);
  if (!context) {
    throw new Error('useSalesforce must be used within SalesforceProvider');
  }
  return context;
}
