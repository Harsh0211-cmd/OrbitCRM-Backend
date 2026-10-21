const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const contract = require('../../contract.json');

// Memory store for test mode or missing tables (tasks, requests, issues, notifications)
const memoryStore = {
  customers: structuredClone(contract.entities.Customer.sampleFixture ? [
    contract.entities.Customer.sampleFixture,
    {
      id: 2,
      name: 'Meera Shah',
      company: 'Horizon Ltd',
      email: 'meera@horizon.example',
      phone: '9822001112',
      status: 'Active',
      date: '20 Sep 2026'
    }
  ] : []),
  leads: [
    structuredClone(contract.entities.Lead.sampleFixture),
    {
      id: 'L-102',
      name: 'Jordan Lee',
      company: 'Nova Retail',
      service: 'IT Support & Maintenance',
      source: 'Referral',
      status: 'Quotation',
      assigned: 'Priya Nair',
      followup: '01 Oct 2026',
      notes: []
    },
    {
      id: 'L-103',
      name: 'Meera Shah',
      company: 'Horizon Ltd',
      service: 'Website Development',
      source: 'LinkedIn',
      status: 'Contacted',
      assigned: 'Priya Nair',
      followup: '03 Oct 2026',
      customerId: 2,
      notes: []
    }
  ],
  projects: [
    structuredClone(contract.entities.Project.sampleFixture),
    {
      id: 'P-102',
      name: 'Horizon Support Portal',
      customer: 'Horizon Ltd',
      customerId: 2,
      service: 'Website & Application Development',
      assigned: 'Vikram Rao',
      status: 'Testing',
      priority: 'Medium',
      deadline: '09 Oct 2026',
      progress: 82,
      updates: []
    }
  ],
  tickets: [
    structuredClone(contract.entities.Ticket.sampleFixture),
    {
      id: 'T-103',
      customer: 'Horizon Ltd',
      customerId: 2,
      subject: 'Unable to reset password',
      priority: 'Medium',
      assigned: 'Ananya Das',
      status: 'New',
      created: '28 Sep 2026',
      due: '02 Oct 2026',
      latest: 'Ticket received.',
      notes: []
    }
  ],
  tasks: [
    structuredClone(contract.entities.Task.sampleFixture),
    {
      id: 2,
      title: 'Build customer registration page',
      department: 'Development',
      assigned: 'Vikram Rao',
      related: 'P-101',
      priority: 'High',
      due: '01 Oct 2026',
      status: 'In Progress'
    },
    {
      id: 3,
      title: 'Verify Acme contact form issue',
      department: 'IT Support',
      assigned: 'Ananya Das',
      related: 'T-102',
      priority: 'High',
      due: '30 Sep 2026',
      status: 'Pending'
    }
  ],
  requests: [
    structuredClone(contract.entities.ServiceRequest.sampleFixture)
  ],
  issues: [],
  notifications: [
    'High-priority ticket T-102 needs attention.',
    'Acme Business Website moved to Development.'
  ],
  employees: [
    { name: 'Priya Nair', id: 'sales.emp', department: 'Sales', email: 'priya@orbitcrm.test', status: 'Active' },
    { name: 'Vikram Rao', id: 'developer.emp', department: 'Development', email: 'vikram@orbitcrm.test', status: 'Active' },
    { name: 'Ananya Das', id: 'support.emp', department: 'IT Support', email: 'ananya@orbitcrm.test', status: 'Active' }
  ],
  departments: [
    { id: 1, name: 'Sales', description: 'Customer leads and quotations', employees: 1, active: '1 active' },
    { id: 2, name: 'Development', description: 'Project delivery and technical work', employees: 1, active: '1 active' },
    { id: 3, name: 'IT Support', description: 'Customer issues and tickets', employees: 1, active: '1 active' }
  ],
  registeredUsers: [],
  settings: {
    companyName: 'Orbit IT Solutions',
    notificationPreference: 'All CRM updates'
  },
  events: []
};

function nextLeadId() {
  const max = memoryStore.leads.reduce((highest, l) => {
    const num = Number(String(l.id).replace(/^L-/i, ''));
    return !isNaN(num) && num > highest ? num : highest;
  }, 100);
  return `L-${max + 1}`;
}

function nextProjectId() {
  const max = memoryStore.projects.reduce((highest, p) => {
    const num = Number(String(p.id).replace(/^P-/i, ''));
    return !isNaN(num) && num > highest ? num : highest;
  }, 100);
  return `P-${max + 1}`;
}

function nextTicketId() {
  const max = memoryStore.tickets.reduce((highest, t) => {
    const num = Number(String(t.id).replace(/^T-/i, ''));
    return !isNaN(num) && num > highest ? num : highest;
  }, 100);
  return `T-${max + 1}`;
}

function nextTaskId() {
  const max = memoryStore.tasks.reduce((highest, t) => {
    const num = Number(t.id);
    return !isNaN(num) && num > highest ? num : highest;
  }, 0);
  return max + 1;
}

function nextRequestId() {
  const max = memoryStore.requests.reduce((highest, r) => {
    const num = Number(String(r.id).replace(/^R-/i, ''));
    return !isNaN(num) && num > highest ? num : highest;
  }, 100);
  return `R-${max + 1}`;
}

function nextIssueId() {
  const max = memoryStore.issues.reduce((highest, i) => {
    const num = Number(String(i.id).replace(/^I-/i, ''));
    return !isNaN(num) && num > highest ? num : highest;
  }, 0);
  return `I-${max + 1}`;
}

// Check if running in isolated faked test mode per Rule DB8
function isTestMode() {
  return process.env.NODE_ENV === 'test' || process.env.FAKE_DB === 'true';
}

// User authentication data access
async function findUserByCredentials(loginId) {
  if (isTestMode()) {
    // Check demo accounts first
    const demo = contract.demoAccounts.find(
      a => a.id === loginId || a.email === loginId
    );
    if (demo) {
      return {
        user_id: 1,
        username: demo.id,
        email: demo.email,
        password_hash: bcrypt.hashSync(demo.password, 10),
        role: demo.role,
        name: demo.name,
        department: demo.department || null,
        company: demo.company || null,
        customerId: demo.role === 'Customer' ? 1 : null,
        phone: demo.phone
      };
    }

    // Check newly registered users
    const registered = memoryStore.registeredUsers.find(
      u => u.username === loginId || u.email === loginId
    );
    if (registered) return registered;

    return null;
  }

  // Real MySQL query
  const query = `
    SELECT u.user_id, u.username, u.email, u.password_hash, u.role,
           COALESCE(e.employee_name, c.customer_name, u.username) AS name,
           d.department_name AS department,
           c.company,
           c.customer_id AS customerId,
           COALESCE(e.contact, c.contact) AS phone
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.user_id
    LEFT JOIN departments d ON d.department_id = e.department_id
    LEFT JOIN customers c ON c.user_id = u.user_id
    WHERE u.username = ? OR u.email = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(query, [loginId, loginId]);
  if (rows.length === 0) return null;

  const row = rows[0];
  // Map MySQL role to contract role casing
  let role = 'Employee';
  if (row.role === 'ADMIN') role = 'Admin';
  else if (row.role === 'CUSTOMER') role = 'Customer';

  return {
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    password_hash: row.password_hash,
    role,
    name: row.name,
    department: row.department,
    company: row.company,
    customerId: row.customerId,
    phone: row.phone
  };
}

module.exports = {
  memoryStore,
  isTestMode,
  findUserByCredentials,
  nextLeadId,
  nextProjectId,
  nextTicketId,
  nextTaskId,
  nextRequestId,
  nextIssueId
};
