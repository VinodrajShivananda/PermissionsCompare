import { STORAGE_KEY } from '../config';
import type { SalesforceSession } from '../types/permissions';

export function loadSession(): SalesforceSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as SalesforceSession;
    if (!data.accessToken || !data.instanceUrl) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(session: SalesforceSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
