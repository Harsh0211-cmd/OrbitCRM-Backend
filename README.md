# OrbitCRM Backend API & Frontend Integration

Backend service for **OrbitCRM (IT Services)** built with **Node.js + Express** connecting to an external database with plain parameterized queries.

---

## 1. Prerequisites & Environment

- **Node.js**: Version 20 or newer (`node -v`)
- **npm**: Version 9 or newer (`npm -v`)

### Setting up `.env`

Create a local `.env` file from `.env.example`:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Windows (Command Prompt):**
```cmd
copy .env.example .env
```

**Unix / macOS:**
```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Example / Required Format |
|---|---|---|
| `PORT` | Local server port | `3000` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `3306` (MySQL) or `5432` (PostgreSQL) |
| `DB_USER` | Database user | `root` or app user |
| `DB_PASSWORD` | Database user password | Your database password |
| `DB_NAME` | Database schema name | `orbitcrm` |
| `JWT_SECRET` | Signing key for auth tokens | Min 32 characters, unguessable |
| `FRONTEND_ORIGIN`| Allowed CORS origin | `http://127.0.0.1:5500` or `*` in dev |
| `NODE_ENV` | Environment mode | `development` or `production` |

> **Recommended Database Account (Rule DB6)**: The application only requires `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on application tables. DDL operations (`CREATE`, `ALTER`, `DROP`) are never executed by runtime code.

---

## 2. Installation & Running

Install dependencies:
```bash
npm install
```

Start the application:
```bash
npm start
```

Run in development watch mode:
```bash
npm run dev
```

The server serves the OrbitCRM frontend at `http://localhost:3000` and API routes under `http://localhost:3000/api/v1`.

---

## 3. Automated Tests

### Unit, Contract & Security Tests
Runs table-driven contract serializers, role-based access control matrix checks, and secret leakage prevention checks using Node's native test runner (`node:test`) against the isolated test data layer:

```bash
npm test
```

### End-to-End Browser Smoke Tests
Runs Playwright automated browser test verifying login, asset loading, console error absence, and dashboard rendering:

```bash
npm run test:e2e
```

---

## 4. Frontend Integration Architecture

- The frontend is served directly from `orbitcrm-frontend-main/orbitcrm-frontend-main/` via `express.static`.
- API base URL setting: `/api/v1` (configured in `src/adapter/frontend-adapter.js`).
- If deploying the frontend separately to Netlify, set the backend API origin in `FRONTEND_ORIGIN` and ensure CORS allows that origin.
