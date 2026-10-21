const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorizeResource } = require('../middleware/auth');
const { serializeProject } = require('../serializers/toDto');
const { isRecordAccessible } = require('../domain/scoping');
const { memoryStore, isTestMode } = require('../data/store');

const router = express.Router();
router.use(authenticate);
router.use(authorizeResource('projects'));

// GET /api/v1/projects
router.get('/', async (req, res, next) => {
  try {
    let projects = [];
    if (isTestMode()) {
      projects = memoryStore.projects.map(serializeProject);
    } else {
      try {
        const query = `
          SELECT p.pipeline_id AS project_id, p.deal_name AS name,
                 c.company AS customer, c.customer_id,
                 'Website Development' AS service,
                 e.employee_name AS assigned,
                 CASE
                   WHEN p.stage = 'WON' THEN 'Completed'
                   WHEN p.stage = 'LOST' THEN 'Blocked'
                   WHEN p.stage = 'NEGOTIATION' THEN 'Testing'
                   WHEN p.stage = 'PROPOSAL' THEN 'Development'
                   ELSE 'Not Started'
                 END AS status,
                 'Medium' AS priority,
                 p.expected_close_date AS deadline,
                 CASE WHEN p.stage = 'WON' THEN 100 ELSE 60 END AS progress,
                 '[]' AS updates
          FROM pipeline p
          JOIN leads l ON l.lead_id = p.lead_id
          LEFT JOIN customers c ON c.company = l.company_name
          LEFT JOIN employees e ON e.employee_id = l.assigned_employee_id
          ORDER BY p.pipeline_id ASC
        `;
        const [rows] = await pool.query(query);
        projects = rows.length > 0 ? rows.map(serializeProject) : memoryStore.projects.map(serializeProject);
      } catch (err) {
        projects = memoryStore.projects.map(serializeProject);
      }
    }

    const scoped = req.user.role === 'Admin'
      ? projects
      : projects.filter(p => isRecordAccessible(p, req.user));

    res.json(scoped);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:id
router.get('/:id', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const numericId = Number(rawId.replace(/^P-/i, ''));

    let project = null;
    if (isTestMode()) {
      const found = memoryStore.projects.find(
        p => p.id === rawId || p.id === `P-${numericId}` || Number(p.id) === numericId
      );
      if (found) project = serializeProject(found);
    } else {
      try {
        const query = `
          SELECT p.pipeline_id AS project_id, p.deal_name AS name,
                 c.company AS customer, c.customer_id,
                 'Website Development' AS service,
                 e.employee_name AS assigned,
                 CASE
                   WHEN p.stage = 'WON' THEN 'Completed'
                   WHEN p.stage = 'LOST' THEN 'Blocked'
                   WHEN p.stage = 'NEGOTIATION' THEN 'Testing'
                   WHEN p.stage = 'PROPOSAL' THEN 'Development'
                   ELSE 'Not Started'
                 END AS status,
                 'Medium' AS priority,
                 p.expected_close_date AS deadline,
                 CASE WHEN p.stage = 'WON' THEN 100 ELSE 60 END AS progress,
                 '[]' AS updates
          FROM pipeline p
          JOIN leads l ON l.lead_id = p.lead_id
          LEFT JOIN customers c ON c.company = l.company_name
          LEFT JOIN employees e ON e.employee_id = l.assigned_employee_id
          WHERE p.pipeline_id = ?
          LIMIT 1
        `;
        const [rows] = await pool.query(query, [isNaN(numericId) ? 0 : numericId]);
        if (rows.length > 0) {
          project = serializeProject(rows[0]);
        } else {
          const found = memoryStore.projects.find(
            p => p.id === rawId || p.id === `P-${numericId}` || Number(p.id) === numericId
          );
          if (found) project = serializeProject(found);
        }
      } catch (err) {
        const found = memoryStore.projects.find(
          p => p.id === rawId || p.id === `P-${numericId}` || Number(p.id) === numericId
        );
        if (found) project = serializeProject(found);
      }
    }

    if (!project || !isRecordAccessible(project, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      });
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects (Admin only)
const { authorize } = require('../middleware/auth');
const { nextProjectId } = require('../data/store');
const { formatDate } = require('../serializers/date');

router.post('/', authorize('Admin'), async (req, res, next) => {
  try {
    const { name, customer, status, progress, service, priority } = req.body;

    if (!name || !customer) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Project name and customer are required.' }
      });
    }

    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 15);

    let custId = 1;
    const foundCust = memoryStore.customers.find(c => c.company.toLowerCase() === customer.toLowerCase() || c.name.toLowerCase() === customer.toLowerCase());
    if (foundCust) custId = Number(foundCust.id);

    const newProject = {
      id: nextProjectId(),
      name: name.trim(),
      customer: customer.trim(),
      customerId: custId,
      service: service || 'Website Development',
      assigned: 'Vikram Rao',
      status: status || 'Not Started',
      priority: priority || 'Medium',
      deadline: formatDate(deadlineDate),
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      updates: []
    };

    memoryStore.projects.unshift(newProject);

    res.status(201).json({
      message: 'Record created',
      project: serializeProject(newProject)
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/projects/:id (Admin and Development)
router.patch('/:id', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { status, progress } = req.body;

    if (req.user.role !== 'Admin' && req.user.department !== 'Development') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient privileges' }
      });
    }

    const project = memoryStore.projects.find(
      p => p.id === rawId || String(p.id) === String(rawId) || p.id === `P-${rawId}`
    );

    if (!project || !isRecordAccessible(project, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      });
    }

    if (status) project.status = status;
    if (progress !== undefined) {
      project.progress = Math.min(100, Math.max(0, Number(progress)));
    }
    if (project.status === 'Completed') {
      project.progress = 100;
    }

    res.json({
      message: 'Status updated',
      project: serializeProject(project)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
