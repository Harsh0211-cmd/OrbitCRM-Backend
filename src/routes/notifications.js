const express = require('express');
const { authenticate } = require('../middleware/auth');
const { memoryStore } = require('../data/store');
const { serializeNotification } = require('../serializers/toDto');

const router = express.Router();
router.use(authenticate);

// GET /api/v1/notifications
router.get('/', (req, res, next) => {
  try {
    const notifications = memoryStore.notifications.map((n, i) => serializeNotification(n, i + 1));
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/clear
router.post('/clear', (req, res) => {
  memoryStore.notifications = [];
  res.json({
    message: 'Notifications cleared'
  });
});

module.exports = router;
