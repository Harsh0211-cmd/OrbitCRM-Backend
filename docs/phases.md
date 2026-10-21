# OrbitCRM Phase-by-Phase Checklist & Acceptance Criteria

> Defines the roadmap, endpoints, tasks, and acceptance criteria for Phase 1, Phase 2, and Phase 3.
> Per Rule G3, approval is required before beginning implementation of any phase.

---

## Phase 1: Foundation, Read Paths & Static Integration

### 1.1 Scope & Tasks
1. **Project Setup & Environment**:
   - Establish \`package.json\` scripts: \`npm run dev\`, \`npm start\`, \`npm test\`, \`npm run test:e2e\`.
   - Setup \`.env.example\` with placeholder values and verify \`.env\` in \`.gitignore\`.
   - Setup shared PostgreSQL connection pool (\`pg.Pool\`) with startup connectivity check (\`SELECT 1\`).
   - Implement fail-fast security startup checks: validate \`JWT_SECRET\` presence and length ($\ge 32$ chars).
2. **Authentication & Identity**:
   - \`POST /api/v1/auth/login\`: Authenticate against \`auth.users\` and \`public.profiles\` using \`bcryptjs\`.
   - Return JWT token and user profile object matching the frontend contract.
   - Exact error message on invalid credentials: \`"Invalid Login ID or Password."\`.
   - \`GET /api/v1/auth/demo-accounts\`: Provide demo account metadata in non-production environments.
3. **Core Read Endpoints**:
   - \`GET /api/v1/bootstrap\`: Aggregated bootstrap payload matching \`contract.json\`.
   - \`GET /api/v1/customers\`, \`GET /api/v1/customers/:id\`
   - \`GET /api/v1/leads\`, \`GET /api/v1/leads/:id\`
   - \`GET /api/v1/projects\`, \`GET /api/v1/projects/:id\`
   - \`GET /api/v1/tickets\`, \`GET /api/v1/tickets/:id\`
   - \`GET /api/v1/tasks\`, \`GET /api/v1/tasks/:id\`
   - \`GET /api/v1/requests\`, \`GET /api/v1/requests/:id\`
   - \`GET /api/v1/employees\` (Admin only)
   - \`GET /api/v1/departments\` (Admin only)
   - \`GET /api/v1/dashboard\`: Scoped metrics, 6-month workflow overview, attention tickets.
   - \`GET /api/v1/notifications\`: Scoped user notification items.
4. **Serializers & Error Envelope**:
   - Implement explicit \`toDto\` serializers per entity enforcing contract key order.
   - Omit optional keys when null/absent.
   - Format all date fields to \`DD Mon YYYY\` in \`Asia/Kolkata\`.
   - Global error handler returning standard envelope: \`{ "error": { "code": "...", "message": "..." } }\`.
   - Unknown \`/api/v1/**\` route handler returning 404 with error envelope.
5. **Frontend Static Serving & Client Adapter**:
   - Serve \`orbitcrm-frontend-main/orbitcrm-frontend-main/\` with \`express.static\` at \`/\`.
   - Ensure \`/api/v1/**\` routes are registered before static/SPA fallbacks.
   - Minimal client adapter (\`api.js\`) bridging \`script.js\` state to backend endpoints.

### 1.2 Acceptance Criteria (Phase 1 Gate)
- [x] Contract tests verify exact key names and exact key order for all read entities.
- [x] Contract tests verify optional keys are omitted when absent, never \`null\`.
- [x] Authz tests verify 403 Forbidden for disallowed roles and 404 for inaccessible records.
- [x] Secret handling test: Connection failure gives clear error and never leaks \`DATABASE_URL\` or passwords.
- [x] Secret handling test: Refuses to boot if \`JWT_SECRET\` is missing or $<32$ characters.
- [x] Playwright smoke test: Loads login screen, logs in as demo user, verifies zero console errors and successful dashboard rendering.

---

## Phase 2: Writes, Automations & Scheduled Jobs

### 2.1 Scope & Tasks
1. **Creation Endpoints**:
   - \`POST /api/v1/leads\`
   - \`POST /api/v1/projects\`
   - \`POST /api/v1/tickets\`
   - \`POST /api/v1/tasks\`
   - \`POST /api/v1/issues\`
   - \`POST /api/v1/requests\`
   - \`POST /api/v1/notes\`
   - \`POST /api/v1/auth/register\` (Customer self-registration)
2. **Update Endpoints**:
   - \`PATCH /api/v1/leads/:id\` (status update & pipeline progression)
   - \`PATCH /api/v1/projects/:id\` (status and progress 0-100)
   - \`PATCH /api/v1/tickets/:id\` (status and latest update note)
   - \`PATCH /api/v1/tasks/:id\` (status update)
   - \`PATCH /api/v1/issues/:id\` (status update)
   - \`PATCH /api/v1/me\` (profile name and phone update; company for customer)
   - \`PUT /api/v1/settings\` (admin company name and notification preference)
   - \`POST /api/v1/notifications/clear\`
3. **Business Automations (Service Layer)**:
   - **Service Request Automation**: Customer submits service request -> creates Request (\`Submitted\`) + Lead (\`Website\`, \`New\`, assigned least-loaded Sales, followup +2 days) + Customer notification (\`"Your service request has been received."\`).
   - **Lead Won Automation**: Lead marked \`Won\` -> creates Project (\`Not Started\`, 0% progress, assigned least-loaded Developer).
   - **Ticket Escalation**: Status marked \`Escalated\` -> triggers notification to Development (\`"<id> has been escalated to Development."\`) and creates Development Task.
   - **Ticket Resolution**: Status marked \`Resolved\` -> notifies customer and admin.
   - **Notes Persistence**: \`POST /notes\` appends note to related record and notifies assignee.
4. **Scheduled Background Jobs**:
   - Periodic SLA breach check: identifies tickets past \`due_at\` and triggers warning notification.
5. **Auxiliary Read Endpoints**:
   - \`GET /api/v1/reports/summary\` (Admin reports summary)
   - \`GET /api/v1/search?q=\` (Global multi-entity search)
   - \`GET /api/v1/events?after=\` (Polling cursor for live updates)

### 2.2 Acceptance Criteria (Phase 2 Gate)
- [x] Write operation tests verify input validation and exact success toast messages.
- [x] Automation tests verify transactional execution of linked records and notifications.
- [x] Duplicate registration rejects with \`"An account with this email already exists."\`.
- [x] Password mismatch on registration rejects with \`"Passwords do not match."\`.
- [x] Profile update verifies email cannot be modified.
- [x] Contract and authz test coverage extended to 100% of new endpoints.

---

## Phase 3: End-to-End Workflows & Deployment Hardening

### 3.1 Scope & Tasks
1. **Full Multi-Role Playwright Test Suite**:
   - Complete workflow tests for each role:
     - Admin: Full pipeline progression, employee management, reports view, settings update.
     - Sales: View assigned leads, drag/move pipeline stage, create lead.
     - Development: View assigned projects, update progress %, report issue.
     - IT Support: View tickets, update ticket to Escalated/Resolved.
     - Customer: Submit service request, verify lead creation, view projects/tickets.
2. **Security & Deployment Hardening**:
   - Strict CORS origin enforcement via \`FRONTEND_ORIGIN\`.
   - Response body scanner test: guarantees no password hashes or sensitive fields leak.
   - Test database isolation test: guarantees tests never run against \`DATABASE_URL\`.
   - Production readiness documentation for Render and Railway.
3. **Traceability Final Audit**:
   - Verify every requirement in \`docs/traceability.md\` has an automated test passing.

### 3.2 Acceptance Criteria (Phase 3 Gate)
- [x] All Playwright E2E role flows pass deterministically.
- [x] `npm test` and `npm run test:e2e` exit with code 0.
- [x] Zero items remain unverified in the traceability matrix.
