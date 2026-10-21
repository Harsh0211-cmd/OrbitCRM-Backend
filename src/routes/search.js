const express = require('express');
const { authenticate } = require('../middleware/auth');
const { memoryStore } = require('../data/store');
const { isRecordAccessible } = require('../domain/scoping');
const {
  serializeCustomer,
  serializeLead,
  serializeProject,
  serializeTicket
} = require('../serializers/toDto');

const router = express.Router();
router.use(authenticate);

// GET /api/v1/search?q=
router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    return res.json([]);
  }

  const user = req.user;

  const customers = (user.role === 'Admin' ? memoryStore.customers : memoryStore.customers.filter(c => isRecordAccessible(c, user)))
    .map(serializeCustomer)
    .filter(c => Object.values(c).join(' ').toLowerCase().includes(q))
    .map(c => ({ ...c, entityType: 'Customer' }));

  const leads = (user.role === 'Admin' || (user.role === 'Employee' && user.department === 'Sales')
    ? (user.role === 'Admin' ? memoryStore.leads : memoryStore.leads.filter(l => isRecordAccessible(l, user)))
    : [])
    .map(serializeLead)
    .filter(l => Object.values(l).join(' ').toLowerCase().includes(q))
    .map(l => ({ ...l, entityType: 'Lead' }));

  const projects = (user.role === 'Admin' || user.role === 'Customer' || (user.role === 'Employee' && user.department === 'Development')
    ? (user.role === 'Admin' ? memoryStore.projects : memoryStore.projects.filter(p => isRecordAccessible(p, user)))
    : [])
    .map(serializeProject)
    .filter(p => Object.values(p).join(' ').toLowerCase().includes(q))
    .map(p => ({ ...p, entityType: 'Project' }));

  const tickets = (user.role === 'Admin' || user.role === 'Customer' || (user.role === 'Employee' && user.department !== 'Sales')
    ? (user.role === 'Admin' ? memoryStore.tickets : memoryStore.tickets.filter(t => isRecordAccessible(t, user)))
    : [])
    .map(serializeTicket)
    .filter(t => Object.values(t).join(' ').toLowerCase().includes(q))
    .map(t => ({ ...t, entityType: 'Ticket' }));

  const results = [...customers, ...leads, ...projects, ...tickets];
  res.json(results);
});

module.exports = router;
