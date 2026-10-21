const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { memoryStore } = require('../data/store');

const router = express.Router();
router.use(authenticate);
router.use(authorize('Admin'));

// GET /api/v1/settings
router.get('/', (req, res) => {
  res.json(memoryStore.settings);
});

// PUT /api/v1/settings
router.put('/', (req, res) => {
  const { companyName, notificationPreference } = req.body;

  if (companyName) {
    memoryStore.settings.companyName = companyName.trim();
  }
  if (notificationPreference) {
    memoryStore.settings.notificationPreference = notificationPreference.trim();
  }

  res.json({
    message: 'Settings saved',
    settings: memoryStore.settings
  });
});

module.exports = router;
