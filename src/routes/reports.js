const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { memoryStore } = require('../data/store');

const router = express.Router();
router.use(authenticate);
router.use(authorize('Admin'));

// GET /api/v1/reports/summary
router.get('/summary', (req, res) => {
  const leads = memoryStore.leads;
  const projects = memoryStore.projects;
  const tickets = memoryStore.tickets;
  const tasks = memoryStore.tasks;

  const countBy = (arr, key) => arr.reduce((acc, item) => {
    const val = item[key] || 'Other';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});

  const leadStatus = countBy(leads, 'status');
  const projectStatus = countBy(projects, 'status');
  const ticketStatus = countBy(tickets, 'status');

  const tasksByDept = {
    Sales: tasks.filter(t => t.department === 'Sales').length,
    Development: tasks.filter(t => t.department === 'Development').length,
    'IT Support': tasks.filter(t => t.department === 'IT Support').length
  };

  res.json({
    leadStatus,
    projectStatus,
    ticketStatus,
    tasksByDept
  });
});

module.exports = router;
