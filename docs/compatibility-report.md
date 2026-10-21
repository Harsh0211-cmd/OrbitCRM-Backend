# OrbitCRM Backend Compatibility Report

> Prepared during **Step 0** as part of the contract and schema compatibility analysis.
> Inputs evaluated: Frontend Source (\`script.js\`), Specification (\`instruction_v2.md\`), Schema (\`schema.sql\` / \`db-schema.sql\`), Master Prompt.

---

## 1. Frontend Runtime Status
- **Current State**: The OrbitCRM frontend at \`orbitcrm-frontend-main/orbitcrm-frontend-main/\` is a **standalone vanilla JS single-page application** running entirely client-side.
- **Storage**: All state is currently persisted in \`localStorage\` under the key \`'orbit-crm-demo'\`.
- **API Calls**: The frontend currently makes **zero real HTTP requests**. Login validates directly against the client-side \`accounts\` array, and mutations modify \`state\` in-memory and write to \`localStorage\`.
- **Conclusion**: A minimal-diff client data adapter (\`api.js\`) will be required in Phase 1 to route authentication, bootstrap, and CRUD requests to the Node.js backend.

---

## 2. Contradictions Between Sources

### 2.1 Backend Technology Stack
- **Contradiction**: \`instruction_v2.md\` was drafted proposing Python 3.11, FastAPI, SQLAlchemy, Alembic, and SQLite.
- **Master Prompt Mandate**: Strictly specifies **Node.js 20+ Express, plain parameterized PostgreSQL (\`pg\` Pool), no ORM, no SQLite, no migration framework**.
- **Resolution**: Master Prompt takes precedence. Backend is 100% Node.js + Express with \`pg\`.

### 2.2 Primary Key Format (UUID vs Integers / Prefixed IDs)
- **Contradiction**:
  - The frontend contract expects IDs formatted as:
    - Customer: Integer (\`1\`, \`2\`)
    - Leads: \`L-101\`, \`L-102\`
    - Projects: \`P-101\`, \`P-102\`
    - Tickets: \`T-101\`, \`T-102\`
    - Tasks: Integer (\`1\`, \`2\`)
    - Requests: \`R-101\`
    - Issues: \`I-1\`
  - The PostgreSQL schema (\`db-schema.sql\`) defines all primary keys as:
    \`id uuid primary key default gen_random_uuid()\`.
- **Resolution Options**:
  - **Option A (Recommended)**: The backend data access layer maintains a bidirectional in-memory LRU mapping between display IDs (e.g. \`L-101\`, customer integer \`1\`) and database UUIDs. Queries filter by UUID or mapped ID transparently.
  - **Option B**: Return UUIDs directly as \`id\` strings. In \`script.js\`, \`String(x.id) === String(id)\` handles string equality, but display badges will show long UUIDs rather than short human-readable codes like \`L-101\`.
  - **Recommendation**: Adopt Option A so the frontend contract and visual display remain 100% faithful to the design.

### 2.3 Role Naming and Casing
- **Contradiction**:
  - PostgreSQL schema: \`profiles.role text check (role in ('admin', 'employee', 'customer'))\` (lowercase).
  - Frontend contract: Roles are capitalized: \`'Admin'\`, \`'Employee'\`, \`'Customer'\`.
- **Resolution**:
  - Serializer transforms database \`role\` to title case on read (\`'Admin'\`, \`'Employee'\`, \`'Customer'\`).
  - Request mapper transforms client role to lowercase on write.

### 2.4 Reset & Bulk Data Operations
- **Contradiction**:
  - \`instruction_v2.md\` Section 13.6 proposes a \`/demo/reset\` endpoint that wipes and rebuilds tables.
  - Master Prompt DB7 explicitly forbids this: *"Never delete or overwrite existing data except through the API operations the specification defines. No bulk deletes, truncates, or 'reset' commands anywhere in the codebase."*
- **Resolution**: Master Prompt rules DB6 and DB7 strictly apply. No \`truncate\`, \`drop\`, or mass reset endpoints will be implemented.

---

## 3. Database Schema Gaps (Missing Tables and Columns)

Per Rule G1 and Scope Backend Only, we do NOT alter the database. The following gaps are documented for review:

| Entity | Missing in Database Schema | Impact & Recommended Runtime Adaptation |
|---|---|---|
| **Ticket** | Column \`description\` | The create ticket form sends \`description\`. The \`public.tickets\` table only has \`subject\`, \`latest_update\`, and \`notes text[]\`. **Recommendation**: Store initial description as the first entry in \`notes\` array (\`notes[1]\`). |
| **Service Request** | Column \`details\` | The request form includes optional \`details\`. The \`public.service_requests\` table only has \`description\`. **Recommendation**: Append \`details\` to \`description\` if present. |
| **Issue** | Columns \`related_project\`, \`priority\`, \`due_at\`, \`department_id\` | Table \`public.issues\` only has \`reporter_user_id\`, \`subject\`, \`description\`, \`status\`, \`assigned_to\`. **Recommendation**: Store project reference in \`description\` header (e.g. \`"[Project P-101] <description>"\`). |
| **Notification** | Column \`kind\` | Table \`public.notifications\` has \`message\`, \`read_at\`, \`created_at\`. It lacks \`kind\`. **Recommendation**: Default \`kind\` to \`'CRM update'\` in serializer. |
| **Settings** | Table \`public.settings\` | Admin settings for \`companyName\` and \`notificationPreference\`. **Recommendation**: Store settings in memory or application configuration with defaults (\`"Orbit IT Solutions"\`, \`"All CRM updates"\`). |
| **Audit / History** | Tables \`status_history\`, \`audit_log\`, \`events\` | Mentioned in \`instruction_v2.md\`. DB schema lacks these tables. **Recommendation**: Implement in-process event bus for live polling cursor without requiring extra DB tables. |

---

## 4. Unresolved Decisions

### Decision 1: Existing Demo Accounts in the External Database
- **Situation**: Master Prompt rule S1 states: *"Do NOT write any code that creates users or seeds demo accounts in the database. Authentication works against the users that already exist there. If the demo accounts do not exist in the database, report it in the Compatibility Report."*
- **Question**: Are the 5 demo accounts (\`admin.admin\`, \`sales.emp\`, \`developer.emp\`, \`support.emp\`, \`customer.user\`) already present in your external database's \`auth.users\` and \`public.profiles\` tables?
- **Options**:
  - Option A: Yes, they are already provisioned with bcrypt hashes matching the demo passwords.
  - Option B: No, they need to be manually registered or provisioned in Supabase auth by the administrator outside the application.
- **Recommendation**: Please verify if these accounts exist in your external database. For automated tests (which run against a test database), test fixtures will be used.

### Decision 2: ID Mapping Strategy
- **Situation**: Database uses UUIDs; frontend displays and links via short IDs (\`L-101\`, \`P-101\`, int \`1\`).
- **Options**:
  - Option A (Recommended): Bidirectional ID adapter mapping UUIDs to readable IDs in the serializer/mapper.
  - Option B: Expose raw UUIDs directly to the frontend.
- **Recommendation**: Option A ensures the frontend UI matches all mocks and table columns exactly.

---

## 5. Requirements That Belong to No Phase
The following items mentioned in \`instruction_v2.md\` are classified as **out-of-scope / future add-ons** and are not assigned to Phase 1, Phase 2, or Phase 3:
1. **Third-Party Integrations** (Section 16): Resend, Brevo, Slack, Teams, UptimeRobot, GitHub, RDAP/SSL, Calendly, Logo.dev, Hunter.io, Twilio/WhatsApp, Anthropic LLM, Razorpay/Stripe, Sentry.
2. **Database Migrations and Schema Alterations**: Forbidden by Master Prompt.
3. **Database Reset and Seed Generation Scripts**: Forbidden against external database by Master Prompt.
