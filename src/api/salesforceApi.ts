import type { SalesforceSession } from '../types/permissions';

interface SoapLoginResponse {
  accessToken: string;
  instanceUrl: string;
  userId?: string;
  orgId?: string;
  username?: string;
  error?: string;
}

interface QueryResponse<T> {
  records: T[];
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  error?: string;
  message?: string;
  errorCode?: string;
}

interface SalesforceErrorItem {
  message?: string;
  errorCode?: string;
}

function formatSalesforceError(data: unknown): string {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as SalesforceErrorItem;
    return first.message ?? first.errorCode ?? 'Salesforce query failed';
  }

  if (data && typeof data === 'object') {
    const record = data as SalesforceErrorItem & { error?: string; message?: string };
    return record.message ?? record.error ?? record.errorCode ?? 'Salesforce query failed';
  }

  return 'Salesforce query failed';
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? 'Server returned an invalid response'
        : `Server error (${response.status}). Is the backend running on port 3001?`,
    );
  }
}

export async function soapLogin(
  username: string,
  password: string,
  loginUrl: string,
): Promise<SoapLoginResponse> {
  const response = await fetch('/auth/soap-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, loginUrl }),
  });

  const data = await parseJson<SoapLoginResponse>(response);

  if (!response.ok) {
    throw new Error(data.error ?? 'Login failed');
  }

  return data;
}

export async function describeGlobal(
  accessToken: string,
  instanceUrl: string,
): Promise<{ error?: string; errorCode?: string }> {
  const response = await fetch('/api/describe-global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, instanceUrl }),
  });

  return parseJson(response);
}

export async function soqlQuery<T>(
  accessToken: string,
  instanceUrl: string,
  query: string,
): Promise<T[]> {
  const allRecords: T[] = [];
  let nextRecordsUrl: string | undefined;

  do {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        instanceUrl,
        query,
        nextRecordsUrl,
      }),
    });

    const data = await parseJson<QueryResponse<T>>(response);

    if (!response.ok || data.error || data.errorCode) {
      throw new Error(formatSalesforceError(data));
    }

    allRecords.push(...data.records);
    nextRecordsUrl = data.done ? undefined : data.nextRecordsUrl;
  } while (nextRecordsUrl);

  return allRecords;
}

export async function toolingQuery<T>(
  accessToken: string,
  instanceUrl: string,
  query: string,
): Promise<T[]> {
  const allRecords: T[] = [];
  let nextRecordsUrl: string | undefined;

  do {
    const response = await fetch('/api/tooling-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        instanceUrl,
        query,
        nextRecordsUrl,
      }),
    });

    const data = await parseJson<QueryResponse<T>>(response);

    if (!response.ok || data.error || data.errorCode) {
      throw new Error(formatSalesforceError(data));
    }

    allRecords.push(...data.records);
    nextRecordsUrl = data.done ? undefined : data.nextRecordsUrl;
  } while (nextRecordsUrl);

  return allRecords;
}

interface DescribeField {
  name: string;
  type: string;
  label?: string;
}

interface DescribeResponse {
  fields?: DescribeField[];
  error?: string;
  message?: string;
  errorCode?: string;
}

export async function describeObject(
  accessToken: string,
  instanceUrl: string,
  objectName: string,
): Promise<DescribeResponse> {
  const response = await fetch(`/api/describe/${objectName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, instanceUrl }),
  });

  const data = await parseJson<DescribeResponse | SalesforceErrorItem[]>(response);

  if (!response.ok) {
    throw new Error(formatSalesforceError(data));
  }

  return data as DescribeResponse;
}

export async function enrichSession(
  login: SoapLoginResponse,
): Promise<SalesforceSession> {
  const [user] = await soqlQuery<{
    Id: string;
    Name: string;
    Username: string;
  }>(
    login.accessToken,
    login.instanceUrl,
    `SELECT Id, Name, Username FROM User WHERE Id = '${login.userId}' LIMIT 1`,
  );

  const [org] = await soqlQuery<{
    Name: string;
    IsSandbox: boolean;
  }>(
    login.accessToken,
    login.instanceUrl,
    'SELECT Name, IsSandbox FROM Organization LIMIT 1',
  );

  const now = new Date().toISOString();

  return {
    id: `${login.orgId ?? 'org'}:${login.userId ?? user?.Id ?? 'user'}`,
    accessToken: login.accessToken,
    instanceUrl: login.instanceUrl,
    userId: login.userId ?? user?.Id ?? '',
    orgId: login.orgId ?? '',
    username: user?.Username ?? login.username ?? '',
    displayName: user?.Name ?? login.username ?? 'Salesforce User',
    orgName: org?.Name ?? login.instanceUrl.replace('https://', ''),
    isSandbox: org?.IsSandbox ?? login.instanceUrl.includes('sandbox'),
    authorizedAt: now,
    lastUsedAt: now,
  };
}
