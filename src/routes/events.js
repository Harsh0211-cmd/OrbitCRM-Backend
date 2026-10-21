const express = require('express');
const { authenticate } = require('../middleware/auth');
const { memoryStore } = require('../data/store');

const router = express.Router();
router.use(authenticate);

// GET /api/v1/events?after=
router.get('/', (req, res) => {
  const after = req.query.after;
  const user = req.user;

  let filtered = memoryStore.events;

  if (after) {
    const afterTime = new Date(after).getTime();
    if (!isNaN(afterTime)) {
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() > afterTime);
    }
  }

  // Filter events by targetAudience and user role / department
  filtered = filtered.filter(e => {
    if (!e.targetAudience || e.targetAudience.includes('All')) return true;
    if (user.role === 'Admin') return true;
    if (e.targetAudience.includes(user.role)) return true;
    if (user.department && e.targetAudience.includes(user.department)) return true;
    return false;
  });

  res.json({
    cursor: new Date().toISOString(),
    events: filtered
  });
});

module.exports = router;
