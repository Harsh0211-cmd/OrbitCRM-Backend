const express = require('express');
const { authenticate } = require('../middleware/auth');
const { memoryStore } = require('../data/store');
const { isRecordAccessible } = require('../domain/scoping');
const { serializeTicket } = require('../serializers/toDto');

const router = express.Router();
router.use(authenticate);

// GET /api/v1/dashboard
router.get('/', (req, res, next) => {
  try {
    const user = req.user;

    const tickets = memoryStore.tickets.map(serializeTicket);
    const scopedTickets = user.role === 'Admin'
      ? tickets
      : tickets.filter(t => isRecordAccessible(t, user));

    const attention = scopedTickets
      .filter(t => t.priority === 'High' || t.status === 'Escalated')
      .slice(0, 3);

    const workflowOverview = [
      { month: 'Apr', value: 35 },
      { month: 'May', value: 52 },
      { month: 'Jun', value: 42 },
      { month: 'Jul', value: 74 },
      { month: 'Aug', value: 61 },
      { month: 'Sep', value: 88 }
    ];

    res.json({
      attention,
      workflowOverview
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
