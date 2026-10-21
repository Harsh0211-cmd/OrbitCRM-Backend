# OrbitCRM Requirements Traceability Matrix

> Maps every specification requirement from \`instruction_v2.md\` and the Master Prompt to a planned implementation phase and named acceptance test.

---

## 1. Traceability Table

| Req ID | Requirement Summary | Source Section | Planned Phase | Named Acceptance Test | Status |
|---|---|---|---|---|---|
| **REQ-AUTH-01** | Support 5 demo accounts with documented Login IDs and passwords | \`instruction_v2.md\` 2.2 | **Phase 1** | \`test_demo_accounts_login_and_tokens\` | **Passed** |
| **REQ-AUTH-02** | Login returns JWT and user payload matching frontend format | \`instruction_v2.md\` 10.1 | **Phase 1** | \`test_login_payload_contract\` | **Passed** |
| **REQ-AUTH-03** | Invalid login ID or password returns exact error message | \`instruction_v2.md\` 11.7 | **Phase 1** | \`test_invalid_credentials_error_envelope\` | **Passed** |
| **REQ-AUTH-04** | Self-registration creates customer and user account | \`instruction_v2.md\` 12.7 | **Phase 2** | \`test_customer_registration_flow\` | **Passed** |
| **REQ-AUTH-05** | Duplicate email registration rejects with exact message | \`instruction_v2.md\` 11.7 | **Phase 2** | \`test_duplicate_email_registration_rejected\` | **Passed** |
| **REQ-BOOT-01** | \`GET /api/v1/bootstrap\` returns initial scoped dataset | \`instruction_v2.md\` 11.2 | **Phase 1** | \`test_bootstrap_endpoint_payload_shape\` | **Passed** |
| **REQ-CONT-01** | Exact camelCase keys and exact key order in JSON responses | Master Prompt C1, C2 | **Phase 1** | \`test_entity_exact_key_names_and_ordering\` | **Passed** |
| **REQ-CONT-02** | Optional fields omitted when null/absent, never sent as null | Master Prompt C2, C3 | **Phase 1** | \`test_optional_fields_omitted_not_null\` | **Passed** |
| **REQ-CONT-03** | Standard JSON error envelope on unknown routes and errors | Master Prompt C5, \`instruction_v2.md\` 11.7 | **Phase 1** | \`test_json_error_envelope_format\` | **Passed** |
| **REQ-CONT-04** | Fixed enumerations match frontend strings byte-for-byte | \`instruction_v2.md\` 2.4 | **Phase 1** | \`test_enums_drift_against_script\` | **Passed** |
| **REQ-DATE-01** | Display dates formatted as \`DD Mon YYYY\` in \`Asia/Kolkata\` | \`instruction_v2.md\` 2.5 | **Phase 1** | \`test_date_formatting_dd_mon_yyyy\` | **Passed** |
| **REQ-RBAC-01** | Role-based authorization middleware across all endpoints | Master Prompt A1, \`instruction_v2.md\` 10.2 | **Phase 1** | \`test_rbac_forbidden_returns_403\` | **Passed** |
| **REQ-RBAC-02** | Inaccessible record returns 404 with no existence leak | Master Prompt A3, \`instruction_v2.md\` 10.2 | **Phase 1** | \`test_inaccessible_record_returns_404\` | **Passed** |
| **REQ-SCOPE-01**| Server-side scoping matching \`mine()\` behavior | \`instruction_v2.md\` 10.3 | **Phase 1** | \`test_server_side_scoping_mine_logic\` | **Passed** |
| **REQ-DASH-01** | Dashboard stat cards scoped and computed per role | \`instruction_v2.md\` 11.5 | **Phase 1** | \`test_dashboard_stats_role_computation\` | **Passed** |
| **REQ-DASH-02** | Dashboard 6-month workflow overview bars | \`instruction_v2.md\` 11.5 | **Phase 1** | \`test_dashboard_workflow_series\` | **Passed** |
| **REQ-DASH-03** | Needs Attention panel shows high priority / escalated tickets | \`instruction_v2.md\` 11.5 | **Phase 1** | \`test_dashboard_needs_attention_scoping\` | **Passed** |
| **REQ-LIST-01** | Read endpoints for initial entities (Customers, Leads, Projects, Tickets, Tasks, Requests) | \`instruction_v2.md\` 11.1 | **Phase 1** | \`test_list_endpoints_read_paths\` | **Passed** |
| **REQ-LIST-02** | Employees and Departments read endpoints (Admin only) | \`instruction_v2.md\` 11.1 | **Phase 1** | \`test_employees_and_departments_list\` | **Passed** |
| **REQ-SERV-01** | Static frontend serving without shadowing \`/api/v1\` | Master Prompt F1, F2 | **Phase 1** | \`test_static_frontend_serving_and_api_priority\` | **Passed** |
| **REQ-E2E-01**  | Browser smoke test (Playwright): login + dashboard rendering | Master Prompt F4 | **Phase 1** | \`test_browser_smoke_login_and_dashboard\` | **Passed** |
| **REQ-WRITE-01**| Create lead, project, ticket, task, request | \`instruction_v2.md\` 11.3 | **Phase 2** | \`test_create_entities_validations\` | **Passed** |
| **REQ-WRITE-02**| Update lead status, project progress/status, ticket status | \`instruction_v2.md\` 11.4 | **Phase 2** | \`test_update_entities_status_and_progress\` | **Passed** |
| **REQ-AUTO-01** | Service request submit creates Request + Lead + Notification | \`instruction_v2.md\` 12.1 | **Phase 2** | \`test_service_request_automation_pipeline\` | **Passed** |
| **REQ-AUTO-02** | Lead Won status auto-creates Project in Not Started | \`instruction_v2.md\` 12.2 | **Phase 2** | \`test_lead_won_auto_creates_project\` | **Passed** |
| **REQ-AUTO-03** | Ticket escalation notifies Development and creates task | \`instruction_v2.md\` 12.5 | **Phase 2** | \`test_ticket_escalation_triggers_notification_and_task\` | **Passed** |
| **REQ-AUTO-04** | Ticket resolution notifies Customer and Admin | \`instruction_v2.md\` 12.5 | **Phase 2** | \`test_ticket_resolution_notification\` | **Passed** |
| **REQ-NOTE-01** | Add note attached to lead/project/ticket with notification | \`instruction_v2.md\` 12.6 | **Phase 2** | \`test_notes_persistence_and_notification\` | **Passed** |
| **REQ-PROF-01** | Profile update (\`PATCH /me\`) with email immutable | \`instruction_v2.md\` 12.7 | **Phase 2** | \`test_profile_update_and_immutable_email\` | **Passed** |
| **REQ-SETT-01** | Admin settings update (\`PUT /settings\`) and notif filter | \`instruction_v2.md\` 12.9 | **Phase 2** | \`test_settings_update_and_notification_filtering\` | **Passed** |
| **REQ-REP-01**  | Reports summary status counts | \`instruction_v2.md\` 11.1 | **Phase 2** | \`test_reports_summary_data\` | **Passed** |
| **REQ-SRCH-01** | Global search across customers, leads, projects, tickets | \`instruction_v2.md\` 11.1 | **Phase 2** | \`test_global_search_endpoint\` | **Passed** |
| **REQ-LIVE-01** | Polling events endpoint (\`GET /api/v1/events?after=\`) | \`instruction_v2.md\` 11.1 | **Phase 2** | \`test_events_polling_endpoint\` | **Passed** |
| **REQ-E2E-02**  | Full multi-role Playwright test suite | Master Prompt Phase 3 | **Phase 3** | \`test_e2e_full_roles_workflows\` | **Passed** |
| **REQ-HARD-01** | Deployment readiness, secret validation, SSL config | Master Prompt Phase 3 | **Phase 3** | \`test_security_and_deployment_hardening\` | **Passed** |
| **REQ-INT-OPT** | Third-party adapters (Resend, Slack, UptimeRobot, etc.) | \`instruction_v2.md\` 16 | **NO PHASE** | None (Optional future add-ons) | Out of scope |
