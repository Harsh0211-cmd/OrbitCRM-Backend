const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleNoteAdded } = require('../services/automation');

const router = express.Router();
router.use(authenticate);

// POST /api/v1/notes
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role === 'Customer') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Customers cannot submit internal notes' }
      });
    }

    const { related, note } = req.body;

    if (!related || !note) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Related record and note content are required.' }
      });
    }

    handleNoteAdded(related.trim(), note.trim(), req.user.name);

    res.status(201).json({
      message: 'Note saved'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
