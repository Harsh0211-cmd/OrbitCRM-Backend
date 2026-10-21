const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { serializeCustomer } = require('../serializers/toDto');
const { isRecordAccessible } = require('../domain/scoping');
const { memoryStore, isTestMode } = require('../data/store');

const router = express.Router();
router.use(authenticate);

// GET /api/v1/customers
router.get('/', async (req, res, next) => {
  try {
    let customers = [];
    if (isTestMode()) {
      customers = memoryStore.customers.map(serializeCustomer);
    } else {
      try {
        let query = `SELECT customer_id, user_id, customer_name AS name, company, contact AS phone, email, created_at
                     FROM customers`;
        const params = [];
        if (req.user.role === 'Customer') {
          query += ` WHERE customer_id = ? OR company = ?`;
          params.push(req.user.customerId || 0, req.user.company || '');
        }
        query += ` ORDER BY customer_id ASC`;
        const [rows] = await pool.query(query, params);
        customers = rows.map(serializeCustomer);
      } catch (err) {
        customers = memoryStore.customers.map(serializeCustomer);
      }
    }

    const scoped = req.user.role === 'Admin'
      ? customers
      : customers.filter(c => isRecordAccessible(c, req.user));

    res.json(scoped);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    let customer = null;
    if (isTestMode()) {
      const found = memoryStore.customers.find(c => Number(c.id) === id);
      if (found) customer = serializeCustomer(found);
    } else {
      try {
        const [rows] = await pool.query(
          `SELECT customer_id, user_id, customer_name AS name, company, contact AS phone, email, created_at
           FROM customers
           WHERE customer_id = ?
           LIMIT 1`,
          [id]
        );
        if (rows.length > 0) customer = serializeCustomer(rows[0]);
      } catch (err) {
        const found = memoryStore.customers.find(c => Number(c.id) === id);
        if (found) customer = serializeCustomer(found);
      }
    }

    if (!customer || !isRecordAccessible(customer, req.user)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    res.json(customer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
