const { formatDate } = require('./date');

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      return [val];
    }
  }
  return [];
}

/**
 * Customer: id, name, company, email, phone, status, date
 */
function serializeCustomer(row) {
  const dto = {};
  dto.id = Number(row.id != null ? row.id : row.customer_id);
  dto.name = String(row.name || row.customer_name || '');
  dto.company = String(row.company || '');
  dto.email = String(row.email || '');
  dto.phone = String(row.phone != null ? row.phone : (row.contact != null ? row.contact : ''));
  dto.status = String(row.status || 'Active');
  dto.date = formatDate(row.date || row.created_at) || '12 Sep 2026';
  return dto;
}

/**
 * Lead: id, name, company, service, source, status, assigned, followup, [customerId], notes
 */
function serializeLead(row) {
  const dto = {};
  dto.id = String(row.id || row.lead_code || `L-${row.lead_id}`);
  dto.name = String(row.name || row.lead_name || '');
  dto.company = String(row.company || row.company_name || '');
  dto.service = String(row.service || 'Website Development');
  dto.source = String(row.source || 'Website');
  dto.status = String(row.status || 'New');
  dto.assigned = String(row.assigned || '');
  dto.followup = formatDate(row.followup || row.followup_at) || '30 Sep 2026';

  const custId = row.customerId != null ? row.customerId : row.customer_id;
  if (custId != null && Number(custId) > 0) {
    dto.customerId = Number(custId);
  }

  dto.notes = parseJsonArray(row.notes);
  return dto;
}

/**
 * Project: id, name, customer, customerId, service, assigned, status, priority, deadline, progress, updates
 */
function serializeProject(row) {
  const dto = {};
  dto.id = String(row.id || row.project_code || `P-${row.project_id}`);
  dto.name = String(row.name || '');
  dto.customer = String(row.customer || row.company || '');
  dto.customerId = Number(row.customerId != null ? row.customerId : row.customer_id || 0);
  dto.service = String(row.service || 'Website Development');
  dto.assigned = String(row.assigned || '');
  dto.status = String(row.status || 'Not Started');
  dto.priority = String(row.priority || 'Medium');
  dto.deadline = formatDate(row.deadline || row.deadline_at) || '15 Oct 2026';
  dto.progress = Number(row.progress != null ? row.progress : 0);
  dto.updates = parseJsonArray(row.updates);
  return dto;
}

/**
 * Ticket: id, customer, customerId, subject, priority, assigned, status, created, due, latest, notes
 */
function serializeTicket(row) {
  const dto = {};
  dto.id = String(row.id || row.ticket_code || `T-${row.ticket_id}`);
  dto.customer = String(row.customer || row.company || '');
  dto.customerId = Number(row.customerId != null ? row.customerId : row.customer_id || 0);
  dto.subject = String(row.subject || row.issue_description || '');
  dto.priority = String(row.priority || 'Medium');
  dto.assigned = String(row.assigned || '');
  dto.status = String(row.status || 'New');
  dto.created = formatDate(row.created || row.created_date || row.created_at) || '25 Sep 2026';
  dto.due = formatDate(row.due || row.due_date || row.due_at) || '30 Sep 2026';
  dto.latest = String(row.latest || 'Ticket received.');
  dto.notes = parseJsonArray(row.notes);
  return dto;
}

/**
 * Task: id, title, department, assigned, related, priority, due, status
 */
function serializeTask(row) {
  const dto = {};
  dto.id = Number(row.id != null ? row.id : row.task_id);
  dto.title = String(row.title || '');
  dto.department = String(row.department || '');
  dto.assigned = String(row.assigned || '');
  dto.related = String(row.related || '');
  dto.priority = String(row.priority || 'Medium');
  dto.due = formatDate(row.due || row.due_date || row.due_at) || '30 Sep 2026';
  dto.status = String(row.status || 'Pending');
  return dto;
}

/**
 * ServiceRequest: id, customerId, service, description, contact, date, status, assigned
 */
function serializeServiceRequest(row) {
  const dto = {};
  dto.id = String(row.id || row.request_code || `R-${row.request_id}`);
  dto.customerId = Number(row.customerId != null ? row.customerId : row.customer_id || 0);
  dto.service = String(row.service || '');
  dto.description = String(row.description || '');
  dto.contact = String(row.contact || 'Email');
  dto.date = formatDate(row.date || row.request_date || row.created_at) || '21 Sep 2026';
  dto.status = String(row.status || 'Submitted');
  dto.assigned = String(row.assigned || '');
  return dto;
}

/**
 * Issue: id, title, related, priority, description, assigned, status
 */
function serializeIssue(row) {
  const dto = {};
  dto.id = String(row.id || row.issue_code || `I-${row.issue_id}`);
  dto.title = String(row.title || '');
  dto.related = String(row.related || '');
  dto.priority = String(row.priority || 'Medium');
  dto.description = String(row.description || '');
  dto.assigned = String(row.assigned || '');
  dto.status = String(row.status || 'New');
  return dto;
}

/**
 * Employee: name, id, department, email, status
 */
function serializeEmployee(row) {
  const dto = {};
  dto.name = String(row.name || row.employee_name || row.full_name || row.username || '');
  dto.id = String(row.id || row.login_id || row.username || '');
  dto.department = String(row.department || row.department_name || '');
  dto.email = String(row.email || '');
  dto.status = row.status || (row.active !== 0 ? 'Active' : 'Inactive');
  return dto;
}

/**
 * Department: id, name, description, employees, active
 */
function serializeDepartment(row, employeeCount = 1) {
  const dto = {};
  dto.id = Number(row.id != null ? row.id : row.department_id);
  dto.name = String(row.name || row.department_name || '');
  dto.description = String(row.description || 'Department operations');
  dto.employees = Number(row.employees != null ? row.employees : employeeCount);
  dto.active = String(row.active || `${dto.employees} active`);
  return dto;
}

/**
 * Notification: id, message, when, kind, read
 */
function serializeNotification(row, idx = 1) {
  const dto = {};
  dto.id = Number(row.id != null ? row.id : (row.notification_id != null ? row.notification_id : idx));
  dto.message = typeof row === 'string' ? row : String(row.message || '');
  dto.when = String(row.when || (row.created_at ? formatDate(row.created_at) : 'Today'));
  dto.kind = String(row.kind || 'CRM update');
  dto.read = Boolean(row.read || row.is_read);
  return dto;
}

/**
 * UserProfile: id, name, role, [department], [company], [customerId], email, [phone]
 */
function serializeUserProfile(user) {
  const dto = {};
  dto.id = String(user.id || user.login_id || user.username);
  dto.name = String(user.name || user.full_name || user.username);
  dto.role = String(user.role);
  if (user.department) dto.department = String(user.department);
  if (user.company) dto.company = String(user.company);
  if (user.customerId != null && Number(user.customerId) > 0) {
    dto.customerId = Number(user.customerId);
  }
  dto.email = String(user.email || '');
  if (user.phone) dto.phone = String(user.phone);
  return dto;
}

module.exports = {
  serializeCustomer,
  serializeLead,
  serializeProject,
  serializeTicket,
  serializeTask,
  serializeServiceRequest,
  serializeIssue,
  serializeEmployee,
  serializeDepartment,
  serializeNotification,
  serializeUserProfile
};
