import cors from 'cors';
import express from 'express';

const app = express();
const PORT = process.env.PORT ?? 3001;
const SOAP_VERSION = '58.0';
const REST_API_VERSION = 'v62.0';

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(express.json());

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.post('/auth/soap-login', async (req, res) => {
  const { username, password, loginUrl } = req.body;

  if (!username || !password || !loginUrl) {
    return res.status(400).json({ error: 'Username, password, and environment are required.' });
  }

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body>
    <urn:login>
      <urn:username>${escapeXml(username)}</urn:username>
      <urn:password>${escapeXml(password)}</urn:password>
    </urn:login>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const response = await fetch(`${loginUrl}/services/Soap/u/${SOAP_VERSION}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml', SOAPAction: 'login' },
      body: soapBody,
    });

    const text = await response.text();
    const accessToken = text.match(/<sessionId>(.*?)<\/sessionId>/)?.[1];
    const serverUrl = text.match(/<serverUrl>(.*?)<\/serverUrl>/)?.[1];
    const userId = text.match(/<userId>(.*?)<\/userId>/)?.[1];
    const organizationId = text.match(/<organizationId>(.*?)<\/organizationId>/)?.[1];

    if (!accessToken || !serverUrl) {
      const fault =
        text.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] || 'Login failed';
      return res.status(401).json({ error: fault });
    }

    const instanceUrl = serverUrl.match(/(https:\/\/[^/]+)/)?.[1];

    res.json({
      accessToken,
      instanceUrl,
      userId,
      orgId: organizationId,
      username,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Login failed',
    });
  }
});

app.post('/auth/logout', (_req, res) => {
  res.json({ success: true });
});

app.post('/api/tooling-query', async (req, res) => {
  const { accessToken, instanceUrl, query, nextRecordsUrl } = req.body;

  if (!accessToken || !instanceUrl) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const url = nextRecordsUrl
      ? `${instanceUrl}${nextRecordsUrl.replace(instanceUrl, '')}`
      : `${instanceUrl}/services/data/${REST_API_VERSION}/tooling/query?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Tooling query failed',
    });
  }
});

app.post('/api/query', async (req, res) => {
  const { accessToken, instanceUrl, query, nextRecordsUrl } = req.body;

  if (!accessToken || !instanceUrl) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const url = nextRecordsUrl
      ? `${instanceUrl}${nextRecordsUrl.replace(instanceUrl, '')}`
      : `${instanceUrl}/services/data/${REST_API_VERSION}/query?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Query failed',
    });
  }
});

app.post('/api/describe/:objectName', async (req, res) => {
  const { accessToken, instanceUrl } = req.body;

  if (!accessToken || !instanceUrl) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const response = await fetch(
      `${instanceUrl}/services/data/${REST_API_VERSION}/sobjects/${req.params.objectName}/describe/`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await response.json();
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Describe failed',
    });
  }
});

app.post('/api/describe-global', async (req, res) => {
  const { accessToken, instanceUrl } = req.body;

  if (!accessToken || !instanceUrl) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const response = await fetch(`${instanceUrl}/services/data/${REST_API_VERSION}/sobjects/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Describe failed',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Salesforce proxy running on http://localhost:${PORT}`);
});
