const express = require('express');
const { authenticate } = require('../middleware/auth');
const { memoryStore, nextIssueId } = require('../data/store');
const { serializeIssue } = require('../serializers/toDto');

const router = express.Router();
router.use(authenticate);

// Middleware: Development and Admin only
router.use((req, res, next) => {
  if (req.user.role !== 'Admin' && req.user.department !== 'Development') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient privileges for technical issues' }
    });
  }
  next();
});

// GET /api/v1/issues
router.get('/', (req, res, next) => {
  try {
    const list = memoryStore.issues.map(serializeIssue);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/issues
router.post('/', async (req, res, next) => {
  try {
    const { title, related, priority, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Issue title and description are required.' }
      });
    }

    const newIssue = {
      id: nextIssueId(),
      title: title.trim(),
      related: related || 'P-101',
      priority: priority || 'Medium',
      description: description.trim(),
      assigned: req.user.name || 'Vikram Rao',
      status: 'New'
    };

    memoryStore.issues.push(newIssue);

    res.status(201).json({
      message: 'Issue reported',
      issue: serializeIssue(newIssue)
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/issues/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { status } = req.body;

    const issue = memoryStore.issues.find(
      i => i.id === rawId || String(i.id) === String(rawId) || i.id === `I-${rawId}`
    );

    if (!issue) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Issue not found' }
      });
    }

    if (status) {
      issue.status = status;
    }

    res.json({
      message: 'Status updated',
      issue: serializeIssue(issue)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
