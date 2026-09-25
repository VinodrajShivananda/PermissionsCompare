# Salesforce Permission Compare

A React app to compare Salesforce permissions across users, profiles, permission sets, and permission set groups.

Authentication uses SOAP username/password login through a local backend proxy (no Connected App, no browser scripts).

## Features

- Compare Users — effective permissions with source attribution
- Compare Profiles — object, field, system, tab, and setup access
- Compare Permission Sets — side-by-side permission diff
- Compare Permission Set Groups — member sets and combined permissions
- Export comparison results to CSV

## Prerequisites

- Node.js 18+
- Salesforce username and password
- Security token appended to password (unless your IP is trusted)

## Run locally

```bash
npm install
npm run dev
```

This starts:
- **Backend** on `http://localhost:3001` (SOAP login + Salesforce API proxy)
- **Frontend** on `http://localhost:5173`

Open http://localhost:5173 and sign in with your Salesforce credentials.

To verify the backend is running independently, open http://localhost:3001/health. It should return `{"status":"ok"}`.

## Deploy to Vercel

Import this repository into Vercel with the default Vite settings. Vercel will use `npm run build` and serve the generated `dist` folder. The included `api/index.js` function serves the Salesforce proxy, so no separate backend deployment or port 3001 is needed in production.

After deployment, verify `https://your-project.vercel.app/health` returns `{"status":"ok"}`. If you use a custom domain, set the `APP_ORIGIN` environment variable to that full origin, for example `https://permissions.example.com`.

## Login

1. Choose **Production** or **Sandbox**
2. Enter your Salesforce **username**
3. Enter **password + security token** (concatenated, e.g. `MyPass123ABC456`)
4. Click **Connect to Salesforce**

You are redirected to the comparison home page after a successful login.

## How authentication works

```
Browser → POST /auth/soap-login → Local Express server → Salesforce SOAP API
Browser → POST /api/query      → Local Express server → Salesforce REST API
```

- Session (`accessToken` + `instanceUrl`) is stored in `localStorage`
- No CORS setup required in Salesforce
- No Connected App required

## Build

```bash
npm run build
npm run preview
```

## Project structure

```
server/           Express SOAP login + API proxy
src/
  api/            Client API + Salesforce client
  auth/           Session storage + React context
  services/       Permission loading and comparison
  components/     UI
  pages/          Routes
```
