# OrbitCRM Deployment Guide

This document describes how to deploy the OrbitCRM Node.js backend to **Render** and **Railway**, connecting to an existing external database (MySQL/PostgreSQL) with strict environment isolation, connection pooling, and security compliance.

---

## 1. Prerequisites & Environment Configuration

OrbitCRM strictly enforces environment variable validation on boot (`src/config/env.js`). If any mandatory variable is missing or insecure, the process will fail fast and exit with code 1.

### Required Environment Variables

| Variable | Description | Example / Allowed Values | Production Rules |
| :--- | :--- | :--- | :--- |
| `PORT` | Listening HTTP port | `3000`, `8080`, or assigned by platform | Fallback to `3000` if not set |
| `NODE_ENV` | Runtime environment | `production` | Enables strict CORS and JWT secret checks |
| `JWT_SECRET` | Cryptographic secret for signing tokens | Min 32 random characters (e.g. `openssl rand -hex 32`) | **Must not** be any default placeholder; >= 32 chars |
| `FRONTEND_ORIGIN` | Allowed CORS origin | `https://orbitcrm.example.com` or `*` (only if monolithic static) | **Must not be `*`** if hosted on separate origin in production |
| `DB_HOST` | Database host | `db.provider.internal` or hostname | Required if `DATABASE_URL` not provided |
| `DB_PORT` | Database port | `3306` (MySQL) or `5432` (PostgreSQL) | Defaults to `3306` |
| `DB_USER` | Database username | `orbit_app` | Parameterized access only |
| `DB_PASSWORD` | Database password | `StrongSecret123!` | Redacted from all log outputs |
| `DB_NAME` | Database schema name | `orbitcrm` | Existing database schema |
| `DB_SSL` | Enable TLS/SSL connection to DB | `true` or `false` | Recommended `true` for cloud-hosted databases |
| `DATABASE_URL` | Complete DB connection string (optional) | `mysql://user:pass@host:3306/db?ssl=true` | Validated against test DB isolation |

---

## 2. Deployment on Render

### Step 1: Create a Web Service
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\to$ **Web Service**.
3. Connect your Git repository containing the backend code.

### Step 2: Configure Service Details
- **Name**: `orbitcrm-backend`
- **Region**: Select the region closest to your external database.
- **Branch**: `main`
- **Root Directory**: Leave blank (or directory containing `package.json` if in a monorepo).
- **Runtime**: `Node`
- **Build Command**: `npm ci --production`
- **Start Command**: `node index.js`
- **Plan**: Starter or Standard.

### Step 3: Configure Environment Variables
In the **Environment** tab, add:
- `NODE_ENV`: `production`
- `PORT`: `10000` (Render's default)
- `JWT_SECRET`: Generate a secure 64-character random string.
- `FRONTEND_ORIGIN`: Your frontend URL (e.g., `https://orbitcrm-app.onrender.com` or `https://app.orbitcrm.com`).
- `DB_HOST`: Host of your external database.
- `DB_PORT`: `3306`
- `DB_USER`: Your external database user.
- `DB_PASSWORD`: Your external database password.
- `DB_NAME`: Your external database name.
- `DB_SSL`: `true`

### Step 4: Health Check Configuration
- Under **Advanced Settings**, set **Health Check Path** to:
  ```text
  /health
  ```
  Render will query `GET /health` to verify that the server is operational and responding with HTTP 200 before routing live traffic.

---

## 3. Deployment on Railway

### Step 1: Create a Railway Project
1. Log into [Railway Dashboard](https://railway.app).
2. Click **New Project** $\to$ **Deploy from GitHub repo**.
3. Select the OrbitCRM repository.

### Step 2: Configure Environment Variables
Navigate to **Variables** in your Railway service settings and input:
- `NODE_ENV`: `production`
- `JWT_SECRET`: Cryptographically strong random key (>= 32 chars).
- `FRONTEND_ORIGIN`: Domain of your frontend deployment.
- `DB_HOST`: External database hostname.
- `DB_PORT`: Port (e.g. `3306`).
- `DB_USER`: Database username.
- `DB_PASSWORD`: Database password.
- `DB_NAME`: Database name.
- `DB_SSL`: `true`

### Step 3: Configure Health Check and Networking
1. Go to **Settings** $\to$ **Deploy**.
2. Set **Healthcheck Path** to `/health`.
3. Set **Healthcheck Timeout** to `10`.
4. Under **Networking**, click **Generate Domain** or map your custom domain.

---

## 4. Architecture & Frontend Serving Strategy

OrbitCRM supports two operational deployment architectures:

### Option A: Monolithic Static Serving (Zero CORS issues)
- The backend serves the existing frontend assets from `orbitcrm-frontend-main/orbitcrm-frontend-main/` via `express.static()`.
- Express dynamically injects the lightweight client data adapter (`<script src="/api-adapter.js"></script>`) during `index.html` stream serving without altering frontend source files on disk.
- In this setup, `FRONTEND_ORIGIN` can be set to the backend's own domain or `http://127.0.0.1:PORT`.

### Option B: Decoupled / Microservices Architecture
- The frontend is hosted on a CDN / Vercel / Cloudflare Pages (e.g., `https://crm.example.com`).
- The backend runs on Render/Railway (e.g., `https://api.example.com`).
- `FRONTEND_ORIGIN` must be set to `https://crm.example.com`.
- The backend CORS middleware (`src/middleware/cors.js`) will reject any origin not matching `FRONTEND_ORIGIN` outside `development`.

---

## 5. Database Connection Pooling & Security

1. **Connection Pool Limits**:
   - The connection pool (`src/config/db.js`) is configured with:
     - `connectionLimit: 10`
     - `queueLimit: 0`
     - `waitForConnections: true`
     - `connectTimeout: 10000`
2. **Sanitized Error Logging**:
   - Database connection errors are scrubbed by `sanitizeDbError()` to ensure connection strings, usernames, and passwords are NEVER emitted to stdout, stderr, or platform log drains.
3. **Strict Zero DDL / Migration Guarantee**:
   - The backend runs **only** parameterized `SELECT`, `INSERT`, `UPDATE`, and `DELETE` runtime data queries.
   - It will **never** execute `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, or destructive data migrations.
4. **Test Database Isolation**:
   - Per Rule DB8, if `TEST_DATABASE_URL` matches `DATABASE_URL`, tests abort immediately to prevent accidental real-database contamination.
