const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorizeResource } = require('../middleware/auth');
const { serializeLead } = require('../serializers/toDto');
const { isRecordAccessible } = require('../domain/scoping');
const { memoryStore, isTestMode } = require('../data/store');

const router = express.Router();
router.use(authenticate);
router.use(authorizeResource('leads'));

// GET /api/v1/leads
router.get('/', async (req, res, next) => {
  try {
    let leads = [];
    if (isTestMode()) {
      leads = memoryStore.leads.map(serializeLead);
    } else {
      try {
        const query = `
          SELECT l.lead_id, l.lead_name AS name, l.company_name AS company,
                 l.source, l.status, l.notes, l.created_at,
                 e.employee_name AS assigned,
                 p.expected_close_date AS followup,
                 c.customer_id
          FROM leads l
          LEFT JOIN employees e ON e.employee_id = l.assigned_employee_id
          LEFT JOIN pipeline p ON p.lead_id = l.lead_id
          LEFT JOIN customers c ON c.company = l.company_name
          ORDER BY l.lead_id ASC
        `;
        const [rows] = await pool.query(query);
        leads = rows.map(serializeLead);
      } catch (err) {
        leads = memoryStore.leads.map(serializeLead);
      }
    }

    const scoped = req.user.role === 'Admin'
      ? leads
      : leads.filter(l => isRecordAccessible(l, req.user));

    res.json(scoped);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leads/:id
router.get('/:id', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const numericId = Number(rawId.replace(/^L-/i, ''));

    let lead = null;
    if (isTestMode()) {
      const found = memoryStore.leads.find(
        l => l.id === rawId || l.id === `L-${numericId}` || Number(l.id) === numericId
      );
      if (found) lead = serializeLead(found);
    } else {
      try {
        const [rows] = await pool.query(
          `SELECT l.lead_id, l.lead_name AS name, l.company_name AS company,
                  l.source, l.status, l.notes, l.created_at,
                  e.employee_name AS assigned,
                  p.expected_close_date AS followup,
                  c.customer_id
           FROM leads l
           LEFT JOIN employees e ON e.employee_id = l.assigned_employee_id
           LEFT JOIN pipeline p ON p.lead_id = l.lead_id
           LEFT JOIN customers c ON c.company = l.company_name
           WHERE l.lead_id = ?
           LIMIT 1`,
          [isNaN(numericId) ? 0 : numericId]
        );
        if (rows.length > 0) lead = serializeLead(rows[0]);
      } catch (err) {
        const found = memoryStore.leads.find(
          l => l.id === rawId || l.id === `L-${numericId}` || Number(l.id) === numericId
        );
        if (found) lead = serializeLead(found);
      }
    }

    if (!lead || !isRecordAccessible(lead, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Lead not found' }
      });
    }

    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/leads
const { nextLeadId } = require('../data/store');
const { formatDate } = require('../serializers/date');
const { handleLeadWon } = require('../services/automation');

router.post('/', async (req, res, next) => {
  try {
    const { name, company, service, status, source, assigned, followup } = req.body;

    if (!name || !company) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Lead name and company are required.' }
      });
    }

    const followupDate = new Date();
    followupDate.setDate(followupDate.getDate() + 2);

    const newLead = {
      id: nextLeadId(),
      name: name.trim(),
      company: company.trim(),
      service: service || 'Website Development',
      source: source || 'Other',
      status: status || 'New',
      assigned: assigned || (req.user.role === 'Admin' ? 'Priya Nair' : req.user.name),
      followup: followup || formatDate(followupDate),
      notes: []
    };

    memoryStore.leads.unshift(newLead);

    res.status(201).json({
      message: 'Record created',
      lead: serializeLead(newLead)
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/leads/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { status } = req.body;

    const lead = memoryStore.leads.find(
      l => l.id === rawId || String(l.id) === String(rawId) || l.id === `L-${rawId}`
    );

    if (!lead || !isRecordAccessible(lead, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Lead not found' }
      });
    }

    if (status) {
      const prevStatus = lead.status;
      lead.status = status;
      if (status === 'Won' && prevStatus !== 'Won') {
        handleLeadWon(lead);
      }
    }

    res.json({
      message: 'Status updated',
      lead: serializeLead(lead)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
