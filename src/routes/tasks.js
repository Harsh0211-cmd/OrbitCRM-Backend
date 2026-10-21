const express = require('express');
const { authenticate, authorizeResource } = require('../middleware/auth');
const { serializeTask } = require('../serializers/toDto');
const { isRecordAccessible } = require('../domain/scoping');
const { memoryStore } = require('../data/store');

const router = express.Router();
router.use(authenticate);
router.use(authorizeResource('tasks'));

// GET /api/v1/tasks
router.get('/', (req, res, next) => {
  try {
    const tasks = memoryStore.tasks.map(serializeTask);
    const scoped = req.user.role === 'Admin'
      ? tasks
      : tasks.filter(t => isRecordAccessible(t, req.user));
    res.json(scoped);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/:id
router.get('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const found = memoryStore.tasks.find(t => Number(t.id) === id);

    if (!found) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Task not found' }
      });
    }

    const dto = serializeTask(found);
    if (!isRecordAccessible(dto, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Task not found' }
      });
    }

    res.json(dto);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks
const { nextTaskId } = require('../data/store');
const { formatDate } = require('../serializers/date');

router.post('/', async (req, res, next) => {
  try {
    const { title, related, priority } = req.body;

    if (!title || !related) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Task title and related record are required.' }
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);

    const newTask = {
      id: nextTaskId(),
      title: title.trim(),
      department: req.user.department || 'Sales',
      assigned: req.user.name || 'Priya Nair',
      related: related.trim(),
      priority: priority || 'Medium',
      due: formatDate(dueDate),
      status: 'Pending'
    };

    memoryStore.tasks.unshift(newTask);

    res.status(201).json({
      message: 'Record created',
      task: serializeTask(newTask)
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tasks/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const task = memoryStore.tasks.find(t => Number(t.id) === id);

    if (!task || !isRecordAccessible(task, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Task not found' }
      });
    }

    if (status) {
      task.status = status;
    }

    res.json({
      message: 'Status updated',
      task: serializeTask(task)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
