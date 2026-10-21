# OrbitCRM Access-Control Matrix (AuthZ)

> Derives permissions from \`instruction_v2.md\` Section 10.2, frontend \`script.js\` modules and \`mine()\` behavior.
> Enforced server-side via route-level \`authorize(...roles)\` and SQL \`WHERE\` scoping filters.

---

## 1. Distinction Between 403 Forbidden and 404 Not Found

Per Authorization Rule A3:
- **403 Forbidden**: The caller's role is never permitted to perform this operation on this resource type (e.g. Customer attempting to \`POST /api/v1/leads\` or view \`/api/v1/employees\`).
- **404 Not Found**: The caller's role is permitted to perform the operation in general, but the requested individual record is outside their permitted scope (e.g. Customer A attempting to \`GET /api/v1/tickets/:id\` for a ticket owned by Customer B). No signal is leaked that the record exists.

---

## 2. Role x Resource x Operation Matrix

| Resource | Operation | Admin | Employee - Sales | Employee - Development | Employee - IT Support | Customer | Scoping Filter (SQL WHERE clause) | Failure if Out-of-Scope |
|---|---|---|---|---|---|---|---|---|
| **Customers** | List | Allowed (all) | Allowed (scoped) | Allowed (scoped) | Allowed (scoped) | Allowed (own) | Admin: None<br>Customer: \`c.id = user.customer_id\`<br>Sales: \`c.id IN (SELECT customer_id FROM leads WHERE assigned_to = user.id)\`<br>Dev: \`c.id IN (SELECT customer_id FROM projects WHERE assigned_to = user.id)\`<br>Support: \`c.id IN (SELECT customer_id FROM tickets WHERE assigned_to = user.id)\` | Empty list / 404 on by-ID |
| **Customers** | Read (by ID) | Allowed (all) | Allowed (scoped) | Allowed (scoped) | Allowed (scoped) | Allowed (own) | Same as above | 404 Not Found |
| **Customers** | Create / Update | Allowed | Disallowed | Disallowed | Disallowed | Disallowed (via profile) | Admin only | 403 Forbidden |
| **Leads** | List / Read | Allowed (all) | Allowed (own) | Disallowed | Disallowed | Disallowed | Admin: None<br>Sales: \`l.assigned_to = user.id\` | 403 (Dev/Support/Cust)<br>404 on by-ID out-of-scope |
| **Leads** | Create | Allowed | Allowed | Disallowed | Disallowed | Disallowed | — | 403 Forbidden |
| **Leads** | Update Status | Allowed | Allowed (own) | Disallowed | Disallowed | Disallowed | Sales: \`l.assigned_to = user.id\` | 403 (Dev/Support/Cust)<br>404 on by-ID out-of-scope |
| **Projects** | List / Read | Allowed (all) | Disallowed | Allowed (own) | Disallowed | Allowed (own) | Admin: None<br>Customer: \`p.customer_id = user.customer_id\`<br>Dev: \`p.assigned_to = user.id\` | 403 (Sales/Support)<br>404 on by-ID out-of-scope |
| **Projects** | Create | Allowed | Disallowed | Disallowed | Disallowed | Disallowed | Admin only | 403 Forbidden |
| **Projects** | Update Progress/Status | Allowed | Disallowed | Allowed (own) | Disallowed | Disallowed | Dev: \`p.assigned_to = user.id\` | 403 (Sales/Support/Cust)<br>404 on by-ID out-of-scope |
| **Tickets** | List / Read | Allowed (all) | Disallowed | Allowed (escalated) | Allowed (own) | Allowed (own) | Admin: None<br>Customer: \`t.customer_id = user.customer_id\`<br>Support: \`t.assigned_to = user.id\`<br>Dev: \`t.status = 'Escalated'\` | 403 (Sales)<br>404 on by-ID out-of-scope |
| **Tickets** | Create | Allowed | Disallowed | Disallowed | Allowed | Allowed (own company) | Customer: force \`customer_id = user.customer_id\` | 403 (Sales/Dev) |
| **Tickets** | Update Status | Allowed | Disallowed | Disallowed | Allowed (own) | Disallowed | Support: \`t.assigned_to = user.id\` | 403 (Sales/Dev/Cust)<br>404 on by-ID out-of-scope |
| **Tasks** | List / Read | Allowed (all) | Allowed (dept) | Allowed (dept) | Allowed (dept) | Disallowed | Admin: None<br>Employee: \`t.assigned_to = user.id OR t.department_id = user.department_id\` | 403 (Customer)<br>404 on by-ID out-of-scope |
| **Tasks** | Create | Allowed | Allowed | Allowed | Allowed | Disallowed | Employees / Admin | 403 (Customer) |
| **Tasks** | Update Status | Allowed | Allowed (own/dept) | Allowed (own/dept) | Allowed (own/dept) | Disallowed | Employees / Admin | 403 (Customer)<br>404 on by-ID out-of-scope |
| **Service Requests** | List / Read | Allowed (all) | Allowed (assigned) | Disallowed | Disallowed | Allowed (own) | Admin: None<br>Customer: \`r.customer_id = user.customer_id\`<br>Sales: \`r.assigned_to = user.id\` | 403 (Dev/Support)<br>404 on by-ID out-of-scope |
| **Service Requests** | Create | Allowed | Disallowed | Disallowed | Disallowed | Allowed | Customer only | 403 (Sales/Dev/Support) |
| **Issues** | List / Read / Create | Allowed | Disallowed | Allowed | Disallowed | Disallowed | Development / Admin only | 403 (Sales/Support/Cust) |
| **Notes** | Create (\`POST /notes\`) | Allowed | Allowed | Allowed | Allowed | Disallowed | Target record must be visible to caller | 403 (Customer)<br>404 if target record inaccessible |
| **Employees** | List / Read / Manage | Allowed | Disallowed | Disallowed | Disallowed | Disallowed | Admin only | 403 Forbidden |
| **Departments**| List / Read / Manage | Allowed | Disallowed | Disallowed | Disallowed | Disallowed | Admin only | 403 Forbidden |
| **Settings** | Read / Update | Allowed | Disallowed | Disallowed | Disallowed | Disallowed | Admin only | 403 Forbidden |
| **Reports** | Read Summary | Allowed | Disallowed | Disallowed | Disallowed | Disallowed | Admin only | 403 Forbidden |
| **Notifications** | List / Read / Clear | Allowed (own) | Allowed (own) | Allowed (own) | Allowed (own) | Allowed (own) | \`n.recipient_user_id = user.id\` | 404 if accessing another's notif |
| **Profile** | Read / Update (\`/me\`) | Allowed (own) | Allowed (own) | Allowed (own) | Allowed (own) | Allowed (own) | Authenticated session user only | 401 Unauthorized |

---

## 3. Required Automated Test Matrix
In Phase 1 and Phase 2, table-driven tests will execute across all 5 demo accounts:
1. \`admin.admin\` (Admin)
2. \`sales.emp\` (Employee - Sales)
3. \`developer.emp\` (Employee - Development)
4. \`support.emp\` (Employee - IT Support)
5. \`customer.user\` (Customer)

Every cell marked "Disallowed" must produce **HTTP 403 Forbidden** with the standard error envelope. Every attempt to access an out-of-scope record ID must produce **HTTP 404 Not Found** with zero information leakage.
