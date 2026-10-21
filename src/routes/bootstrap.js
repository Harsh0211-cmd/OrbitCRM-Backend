const express = require('express');
const { authenticate } = require('../middleware/auth');
const { memoryStore, isTestMode } = require('../data/store');
const { pool } = require('../config/db');
const {
  serializeUserProfile,
  serializeCustomer,
  serializeLead,
  serializeProject,
  serializeTicket,
  serializeTask,
  serializeServiceRequest,
  serializeIssue,
  serializeNotification
} = require('../serializers/toDto');
const { isRecordAccessible } = require('../domain/scoping');

const router = express.Router();
router.use(authenticate);

// GET /api/v1/bootstrap
router.get('/', async (req, res, next) => {
  try {
    const userDto = serializeUserProfile(req.user);

    let customers = [];
    let leads = [];
    let projects = [];
    let tickets = [];
    let tasks = [];
    let requests = [];
    let issues = [];
    let notifications = [];

    if (isTestMode()) {
      customers = memoryStore.customers.map(serializeCustomer);
      leads = memoryStore.leads.map(serializeLead);
      projects = memoryStore.projects.map(serializeProject);
      tickets = memoryStore.tickets.map(serializeTicket);
      tasks = memoryStore.tasks.map(serializeTask);
      requests = memoryStore.requests.map(serializeServiceRequest);
      issues = memoryStore.issues.map(serializeIssue);
      notifications = memoryStore.notifications.map((n, i) => serializeNotification(n, i + 1));
    } else {
      // Query MySQL for customers
      try {
        const [custRows] = await pool.query(
          `SELECT customer_id, user_id, customer_name AS name, company, contact AS phone, email, created_at
           FROM customers`
        );
        customers = custRows.map(serializeCustomer);
      } catch (e) {
        customers = memoryStore.customers.map(serializeCustomer);
      }

      // Query MySQL for leads
      try {
        const [leadRows] = await pool.query(
          `SELECT l.lead_id, l.lead_name AS name, l.company_name AS company,
                  l.source, l.status, l.notes, l.created_at,
                  e.employee_name AS assigned,
                  p.expected_close_date AS followup,
                  c.customer_id
           FROM leads l
           LEFT JOIN employees e ON e.employee_id = l.assigned_employee_id
           LEFT JOIN pipeline p ON p.lead_id = l.lead_id
           LEFT JOIN customers c ON c.company = l.company_name`
        );
        leads = leadRows.map(serializeLead);
      } catch (e) {
        leads = memoryStore.leads.map(serializeLead);
      }

      // Query MySQL for tickets
      try {
        const [ticketRows] = await pool.query(
          `SELECT t.ticket_id, c.company AS customer, t.customer_id,
                  t.issue_description AS subject,
                  CASE t.priority WHEN 'HIGH' THEN 'High' WHEN 'LOW' THEN 'Low' ELSE 'Medium' END AS priority,
                  e.employee_name AS assigned,
                  CASE t.status WHEN 'RESOLVED' THEN 'Resolved' WHEN 'IN_PROGRESS' THEN 'In Progress' ELSE 'New' END AS status,
                  t.created_at AS created,
                  DATE_ADD(t.created_at, INTERVAL 5 DAY) AS due,
                  'Ticket received.' AS latest,
                  '[]' AS notes
           FROM tickets t
           JOIN customers c ON c.customer_id = t.customer_id
           LEFT JOIN employees e ON e.employee_id = t.assigned_employee_id`
        );
        tickets = ticketRows.map(serializeTicket);
      } catch (e) {
        tickets = memoryStore.tickets.map(serializeTicket);
      }

      // Fallback for tables not in MySQL schema per Compatibility Report
      projects = memoryStore.projects.map(serializeProject);
      tasks = memoryStore.tasks.map(serializeTask);
      requests = memoryStore.requests.map(serializeServiceRequest);
      issues = memoryStore.issues.map(serializeIssue);
      notifications = memoryStore.notifications.map((n, i) => serializeNotification(n, i + 1));
    }

    // Apply scoping per user role
    const scopedCustomers = req.user.role === 'Admin'
      ? customers
      : customers.filter(c => isRecordAccessible(c, req.user));

    const scopedLeads = req.user.role === 'Admin'
      ? leads
      : leads.filter(l => isRecordAccessible(l, req.user));

    const scopedProjects = req.user.role === 'Admin'
      ? projects
      : projects.filter(p => isRecordAccessible(p, req.user));

    const scopedTickets = req.user.role === 'Admin'
      ? tickets
      : tickets.filter(t => isRecordAccessible(t, req.user));

    const scopedTasks = req.user.role === 'Admin'
      ? tasks
      : tasks.filter(t => isRecordAccessible(t, req.user));

    const scopedRequests = req.user.role === 'Admin'
      ? requests
      : requests.filter(r => isRecordAccessible(r, req.user));

    res.json({
      user: userDto,
      customers: scopedCustomers,
      leads: scopedLeads,
      projects: scopedProjects,
      tickets: scopedTickets,
      tasks: scopedTasks,
      requests: scopedRequests,
      issues,
      notifications
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
