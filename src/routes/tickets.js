const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorizeResource } = require('../middleware/auth');
const { serializeTicket } = require('../serializers/toDto');
const { isRecordAccessible } = require('../domain/scoping');
const { memoryStore, isTestMode } = require('../data/store');

const router = express.Router();
router.use(authenticate);
router.use(authorizeResource('tickets'));

// GET /api/v1/tickets
router.get('/', async (req, res, next) => {
  try {
    let tickets = [];
    if (isTestMode()) {
      tickets = memoryStore.tickets.map(serializeTicket);
    } else {
      try {
        const query = `
          SELECT t.ticket_id, c.company AS customer, t.customer_id,
                 t.issue_description AS subject,
                 CASE t.priority WHEN 'HIGH' THEN 'High' WHEN 'LOW' THEN 'Low' ELSE 'Medium' END AS priority,
                 e.employee_name AS assigned,
                 CASE t.status WHEN 'RESOLVED' THEN 'Resolved' WHEN 'IN_PROGRESS' THEN 'In Progress' ELSE 'New' END AS status,
                 t.created_at AS created,
                 DATE_ADD(t.created_at, INTERVAL 5 DAY) AS due,
                 'Support is investigating.' AS latest,
                 '[]' AS notes
          FROM tickets t
          JOIN customers c ON c.customer_id = t.customer_id
          LEFT JOIN employees e ON e.employee_id = t.assigned_employee_id
          ORDER BY t.ticket_id ASC
        `;
        const [rows] = await pool.query(query);
        tickets = rows.map(serializeTicket);
      } catch (err) {
        tickets = memoryStore.tickets.map(serializeTicket);
      }
    }

    const scoped = req.user.role === 'Admin'
      ? tickets
      : tickets.filter(t => isRecordAccessible(t, req.user));

    res.json(scoped);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tickets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const numericId = Number(rawId.replace(/^T-/i, ''));

    let ticket = null;
    if (isTestMode()) {
      const found = memoryStore.tickets.find(
        t => t.id === rawId || t.id === `T-${numericId}` || Number(t.id) === numericId
      );
      if (found) ticket = serializeTicket(found);
    } else {
      try {
        const query = `
          SELECT t.ticket_id, c.company AS customer, t.customer_id,
                 t.issue_description AS subject,
                 CASE t.priority WHEN 'HIGH' THEN 'High' WHEN 'LOW' THEN 'Low' ELSE 'Medium' END AS priority,
                 e.employee_name AS assigned,
                 CASE t.status WHEN 'RESOLVED' THEN 'Resolved' WHEN 'IN_PROGRESS' THEN 'In Progress' ELSE 'New' END AS status,
                 t.created_at AS created,
                 DATE_ADD(t.created_at, INTERVAL 5 DAY) AS due,
                 'Support is investigating.' AS latest,
                 '[]' AS notes
          FROM tickets t
          JOIN customers c ON c.customer_id = t.customer_id
          LEFT JOIN employees e ON e.employee_id = t.assigned_employee_id
          WHERE t.ticket_id = ?
          LIMIT 1
        `;
        const [rows] = await pool.query(query, [isNaN(numericId) ? 0 : numericId]);
        if (rows.length > 0) ticket = serializeTicket(rows[0]);
      } catch (err) {
        const found = memoryStore.tickets.find(
          t => t.id === rawId || t.id === `T-${numericId}` || Number(t.id) === numericId
        );
        if (found) ticket = serializeTicket(found);
      }
    }

    if (!ticket || !isRecordAccessible(ticket, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      });
    }

    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tickets
const { nextTicketId } = require('../data/store');
const { formatDate } = require('../serializers/date');
const { handleTicketEscalated, handleTicketResolved } = require('../services/automation');

router.post('/', async (req, res, next) => {
  try {
    const { subject, description, priority, customer } = req.body;

    if (!subject || !description) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Subject and description are required.' }
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    let custName = customer || 'Acme Technologies';
    let custId = 1;

    if (req.user.role === 'Customer') {
      custName = req.user.company || 'Acme Technologies';
      custId = req.user.customerId || 1;
    } else if (customer) {
      const foundCust = memoryStore.customers.find(c => c.company.toLowerCase() === customer.toLowerCase() || c.name.toLowerCase() === customer.toLowerCase());
      if (foundCust) {
        custId = Number(foundCust.id);
        custName = foundCust.company;
      }
    }

    const newTicket = {
      id: nextTicketId(),
      customer: custName,
      customerId: custId,
      subject: subject.trim(),
      priority: priority || 'Medium',
      assigned: 'Ananya Das',
      status: 'New',
      created: formatDate(new Date()),
      due: formatDate(dueDate),
      latest: 'Ticket received.',
      notes: [description.trim()]
    };

    memoryStore.tickets.unshift(newTicket);

    res.status(201).json({
      message: 'Record created',
      ticket: serializeTicket(newTicket)
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tickets/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { status, latest } = req.body;

    const ticket = memoryStore.tickets.find(
      t => t.id === rawId || String(t.id) === String(rawId) || t.id === `T-${rawId}`
    );

    if (!ticket || !isRecordAccessible(ticket, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      });
    }

    if (status) {
      const prevStatus = ticket.status;
      ticket.status = status;
      if (status === 'Escalated' && prevStatus !== 'Escalated') {
        handleTicketEscalated(ticket);
      } else if (status === 'Resolved' && prevStatus !== 'Resolved') {
        handleTicketResolved(ticket);
      }
    }

    if (latest) {
      ticket.latest = latest.trim();
    }

    res.json({
      message: 'Status updated',
      ticket: serializeTicket(ticket)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
