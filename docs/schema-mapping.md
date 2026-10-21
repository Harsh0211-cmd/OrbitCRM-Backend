# OrbitCRM Database Schema Mapping

> Generated in Step 0 based on \`orbitcrm-frontend-main/schema.sql\` (\`db-schema.sql\`) and \`contract.json\`.
> Database Type: **PostgreSQL** (Supabase schema with \`public\` and \`auth\` schemas).
> Constraint: No DDL or schema alterations are permitted. All mappings must occur in the runtime data access layer.

---

## 1. Schema Architecture Overview

The database uses a PostgreSQL schema typical of Supabase environments:
- **Authentication**: Managed via \`auth.users\` (UUID primary key, bcrypt-hashed passwords in \`encrypted_password\`, metadata in \`raw_user_meta_data\`).
- **User Profiles**: \`public.profiles\` links \`auth.users.id\` to application-specific roles (\`admin\`, \`employee\`, \`customer\`), departments, and login identifiers.
- **Tenancy / Scoping**: Customers own records or are referenced by foreign keys. Staff roles (\`admin\`, \`employee\`) access records by assigned profile or department.
- **Primary Keys**: Every table uses \`uuid primary key default gen_random_uuid()\`.

---

## 2. Entity-by-Entity Mapping

### 2.1 Customer
- **Database Table**: \`public.customers\`
- **Foreign Keys**: \`owner_user_id\` -> \`auth.users(id)\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` | \`id\` | \`uuid\` | No | Type mismatch: Contract uses integer (\`1\`, \`2\`), DB uses UUID. Runtime adaptation required (see Compatibility Report). |
| \`name\` | \`contact_name\` | \`text\` | No | Direct column name map: \`contact_name\` -> \`name\`. |
| \`company\` | \`company_name\` | \`text\` | No | Direct column name map: \`company_name\` -> \`company\`. |
| \`email\` | \`email\` | \`text\` | No | Exact match. |
| \`phone\` | \`phone\` | \`text\` | Yes | Direct map; omitted when null in API response per C2. |
| \`status\` | \`status\` | \`text\` | No | Default \`'Active'\`. Matches contract enum. |
| \`date\` | \`created_at\` | \`timestamptz\` | No | Format: \`to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY')\`. |
| *(unmapped DB col)* | \`owner_user_id\` | \`uuid\` | Yes | Internal FK; omitted from frontend contract. |
| *(unmapped DB col)* | \`updated_at\` | \`timestamptz\` | No | Internal audit timestamp; omitted from contract. |

---

### 2.2 Profile / Employee / User
- **Database Table**: \`public.profiles\` JOIN \`public.departments\` JOIN \`auth.users\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` (loginId) | \`login_id\` | \`text\` | Yes (unique) | \`profiles.login_id\` (e.g. \`admin.admin\`, \`sales.emp\`) or \`email\`. |
| \`name\` | \`full_name\` | \`text\` | No | Direct column name map: \`full_name\` -> \`name\`. |
| \`role\` | \`role\` | \`text\` | No | Casing mismatch: DB has check \`('admin', 'employee', 'customer')\`; frontend contract expects \`'Admin', 'Employee', 'Customer'\`. Case transformation required in serializer. |
| \`department\` | \`departments.name\` | \`text\` | Yes | JOIN \`public.departments ON departments.id = profiles.department_id\`. |
| \`email\` | \`email\` | \`text\` | No | Exact match. |
| \`phone\` | \`phone\` | \`text\` | Yes | Direct map; omitted when null. |
| \`status\` | \`active\` | \`boolean\` | No | Boolean \`true\` -> \`'Active'\`, \`false\` -> \`'Inactive'\`. |

---

### 2.3 Lead
- **Database Table**: \`public.leads\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` | \`id\` | \`uuid\` | No | Format mismatch: Contract expects \`L-101\`, DB generates UUID. |
| \`name\` | \`contact_name\` | \`text\` | No | Direct column name map: \`contact_name\` -> \`name\`. |
| \`company\` | \`company_name\` | \`text\` | No | Direct column name map: \`company_name\` -> \`company\`. |
| \`service\` | \`service\` | \`text\` | No | Direct map. |
| \`source\` | \`source\` | \`text\` | No | Default \`'Other'\`. |
| \`status\` | \`status\` | \`text\` | No | Matches pipeline stage enums. |
| \`assigned\` | \`assigned_to\` | \`uuid\` | Yes | FK to \`public.profiles(user_id)\`. Serializer joins \`profiles.full_name\`. |
| \`followup\` | \`followup_at\` | \`date\` | Yes | Format \`DD Mon YYYY\`. |
| \`customerId\` | \`customer_id\` | \`uuid\` | Yes | Optional field. Type mismatch: Contract expects int, DB is UUID. Omitted when null. |
| \`notes\` | \`notes\` | \`text[]\` | No | Array of strings; direct map to \`notes\` array. |
| *(unmapped DB col)* | \`created_at\` | \`timestamptz\` | No | Used for sorting (newest first). |
| *(unmapped DB col)* | \`updated_at\` | \`timestamptz\` | No | Internal audit timestamp. |

---

### 2.4 Project
- **Database Table**: \`public.projects\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` | \`id\` | \`uuid\` | No | Format mismatch: Contract expects \`P-101\`, DB is UUID. |
| \`name\` | \`name\` | \`text\` | No | Direct map. |
| \`customer\` | *(joined)* | \`text\` | No | JOIN \`public.customers c ON c.id = projects.customer_id -> c.company_name\`. |
| \`customerId\` | \`customer_id\` | \`uuid\` | No | Foreign key to \`customers.id\`. Type mismatch: Contract integer vs DB UUID. |
| \`service\` | \`service\` | \`text\` | No | Direct map. |
| \`assigned\` | \`assigned_to\` | \`uuid\` | Yes | FK to \`profiles(user_id)\`. Serializer joins \`profiles.full_name\`. |
| \`status\` | \`status\` | \`text\` | No | Default \`'Not Started'\`. Matches project status enum. |
| \`priority\` | \`priority\` | \`text\` | No | Default \`'Medium'\`. Matches priority enum. |
| \`deadline\` | \`deadline\` | \`date\` | Yes | Format \`DD Mon YYYY\`. |
| \`progress\` | \`progress\` | \`integer\` | No | Range 0 to 100. |
| \`updates\` | \`updates\` | \`text[]\` | No | Array of strings; direct map. |

---

### 2.5 Ticket
- **Database Table**: \`public.tickets\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` | \`id\` | \`uuid\` | No | Format mismatch: Contract expects \`T-102\`, DB is UUID. |
| \`customer\` | *(joined)* | \`text\` | No | JOIN \`public.customers c ON c.id = tickets.customer_id -> c.company_name\`. |
| \`customerId\` | \`customer_id\` | \`uuid\` | No | Foreign key to \`customers.id\`. Contract int vs DB UUID. |
| \`subject\` | \`subject\` | \`text\` | No | Direct map. |
| \`priority\` | \`priority\` | \`text\` | No | Default \`'Medium'\`. |
| \`assigned\` | \`assigned_to\` | \`uuid\` | Yes | FK to \`profiles(user_id)\`. Serializer joins \`profiles.full_name\`. |
| \`status\` | \`status\` | \`text\` | No | Default \`'New'\`. Matches ticket status enum. |
| \`created\` | \`created_at\` | \`timestamptz\` | No | Format \`DD Mon YYYY\`. |
| \`due\` | \`due_at\` | \`date\` | Yes | Format \`DD Mon YYYY\`. |
| \`latest\` | \`latest_update\` | \`text\` | Yes | Direct column name map: \`latest_update\` -> \`latest\`. |
| \`notes\` | \`notes\` | \`text[]\` | No | Array of strings. |
| \`description\` | **MISSING** | — | — | Contract / form sends \`description\` on ticket creation. DB table has no \`description\` column! Stored in \`notes[1]\` or \`latest_update\`. |

---

### 2.6 Task
- **Database Table**: \`public.tasks\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` | \`id\` | \`uuid\` | No | Type mismatch: Contract uses integer (\`1\`), DB is UUID. |
| \`title\` | \`title\` | \`text\` | No | Direct map. |
| \`department\` | \`department_id\` | \`uuid\` | Yes | FK to \`departments.id\`. Serializer joins \`departments.name\`. |
| \`assigned\` | \`assigned_to\` | \`uuid\` | Yes | FK to \`profiles(user_id)\`. Serializer joins \`profiles.full_name\`. |
| \`related\` | \`related_reference\` | \`text\` | Yes | Direct column name map: \`related_reference\` -> \`related\` (\`L-101\`, etc.). |
| \`priority\` | \`priority\` | \`text\` | No | Default \`'Medium'\`. |
| \`due\` | \`due_at\` | \`date\` | Yes | Format \`DD Mon YYYY\`. |
| \`status\` | \`status\` | \`text\` | No | Default \`'Pending'\`. |

---

### 2.7 Service Request
- **Database Table**: \`public.service_requests\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` | \`id\` | \`uuid\` | No | Format mismatch: Contract expects \`R-101\`, DB is UUID. |
| \`customerId\` | \`customer_id\` | \`uuid\` | No | FK to \`customers.id\`. Contract int vs DB UUID. |
| \`service\` | \`service\` | \`text\` | No | Direct map. |
| \`description\` | \`description\` | \`text\` | No | Direct map. |
| \`contact\` | \`contact_method\` | \`text\` | No | Direct column name map: \`contact_method\` -> \`contact\`. |
| \`date\` | \`created_at\` | \`timestamptz\` | No | Format \`DD Mon YYYY\`. |
| \`status\` | \`status\` | \`text\` | No | Default \`'Submitted'\`. |
| \`assigned\` | \`assigned_to\` | \`uuid\` | Yes | FK to \`profiles(user_id)\`. Serializer joins \`profiles.full_name\`. |
| \`details\` | **MISSING** | — | — | Form has optional \`details\`, discarded by old frontend, missing in DB table. |

---

### 2.8 Technical Issue
- **Database Table**: \`public.issues\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` | \`id\` | \`uuid\` | No | Format mismatch: Contract expects \`I-1\`, DB is UUID. |
| \`title\` | \`subject\` | \`text\` | No | Column name map: \`subject\` -> \`title\`. |
| \`related\` | **MISSING** | — | — | Form sends related project ID. DB has no \`related_project\` column! (Can be prepended to description). |
| \`priority\` | **MISSING** | — | — | Form sends priority. DB has no \`priority\` column! |
| \`description\` | \`description\` | \`text\` | No | Direct map. |
| \`assigned\` | \`assigned_to\` | \`uuid\` | Yes | FK to \`profiles(user_id)\`. Serializer joins \`profiles.full_name\`. |
| \`status\` | \`status\` | \`text\` | No | Default \`'New'\`. |
| *(unmapped DB col)* | \`reporter_user_id\` | \`uuid\` | No | FK to \`profiles(user_id)\`. Populated from authenticated session. |

---

### 2.9 Notification
- **Database Table**: \`public.notifications\`

| Contract Key (Frontend) | Database Column | DB Type | Nullable | Mapping / Conversion Rule |
|---|---|---|---|---|
| \`id\` | \`id\` | \`uuid\` | No | Contract integer vs DB UUID. |
| \`message\` | \`message\` | \`text\` | No | Direct map. |
| \`when\` | \`created_at\` | \`timestamptz\` | No | Computed: \`'Today'\`, \`'Yesterday'\`, or \`'N days ago'\`. |
| \`kind\` | *(constant)* | — | — | DB lacks \`kind\`; default to \`'CRM update'\`. |
| \`read\` | \`read_at\` | \`timestamptz\` | Yes | Boolean: \`read_at IS NOT NULL\`. |

---

## 3. Storage of Roles and Password Hashes

1. **Password Storage**:
   - The existing database uses Supabase's \`auth.users\` table.
   - Passwords in \`auth.users\` are stored in the column \`encrypted_password text\` hashed with **bcrypt** (standard prefix \`$2a$\` or \`$2b$\`).
   - The backend will authenticate using \`bcryptjs.compare(password, user.encrypted_password)\`.
   - Passwords are never stored in plaintext and never returned in any response.

2. **Role Storage**:
   - Roles are stored in \`public.profiles.role\` with check constraint: \`role IN ('admin', 'employee', 'customer')\`.
   - Frontend contract requires capitalized roles: \`Admin\`, \`Employee\`, \`Customer\`.
   - The serializer maps \`'admin' -> 'Admin'\`, \`'employee' -> 'Employee'\`, \`'customer' -> 'Customer'\`.
   - Employee department is linked via \`profiles.department_id\` referencing \`public.departments.id\`.
