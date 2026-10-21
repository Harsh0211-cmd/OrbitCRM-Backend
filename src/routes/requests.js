const express = require('express');
const { authenticate, authorizeResource } = require('../middleware/auth');
const { serializeServiceRequest } = require('../serializers/toDto');
const { isRecordAccessible } = require('../domain/scoping');
const { memoryStore } = require('../data/store');

const router = express.Router();
router.use(authenticate);
router.use(authorizeResource('requests'));

// GET /api/v1/requests
router.get('/', (req, res, next) => {
  try {
    const requests = memoryStore.requests.map(serializeServiceRequest);
    const scoped = req.user.role === 'Admin'
      ? requests
      : requests.filter(r => isRecordAccessible(r, req.user));
    res.json(scoped);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/requests/:id
router.get('/:id', (req, res, next) => {
  try {
    const rawId = req.params.id;
    const found = memoryStore.requests.find(
      r => r.id === rawId || String(r.id) === String(rawId)
    );

    if (!found) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Service request not found' }
      });
    }

    const dto = serializeServiceRequest(found);
    if (!isRecordAccessible(dto, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Service request not found' }
      });
    }

    res.json(dto);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/requests (Customer self-service)
const { nextRequestId } = require('../data/store');
const { formatDate } = require('../serializers/date');
const { handleServiceRequestCreated } = require('../services/automation');

router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'Customer' && req.user.role !== 'Admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only customers can submit service requests' }
      });
    }

    const { service, description, contact, details } = req.body;

    if (!service || !description) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Service and description are required.' }
      });
    }

    const fullDesc = details ? `${description.trim()}\n\nAdditional details: ${details.trim()}` : description.trim();

    const newRequest = {
      id: nextRequestId(),
      customerId: req.user.customerId || 1,
      service: service.trim(),
      description: fullDesc,
      contact: contact || 'Email',
      date: formatDate(new Date()),
      status: 'Submitted',
      assigned: 'Priya Nair'
    };

    memoryStore.requests.unshift(newRequest);

    // Automation: create linked Lead + Customer Notification
    handleServiceRequestCreated(newRequest, req.user);

    res.status(201).json({
      message: 'Service request submitted successfully',
      request: serializeServiceRequest(newRequest)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
