const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { serializeEmployee } = require('../serializers/toDto');
const { memoryStore, isTestMode } = require('../data/store');
const { pool } = require('../config/db');

const router = express.Router();
router.use(authenticate);
router.use(authorize('Admin'));

// GET /api/v1/employees (Admin only)
router.get('/', async (req, res, next) => {
  try {
    let employees = [];
    if (isTestMode()) {
      employees = memoryStore.employees.map(serializeEmployee);
    } else {
      try {
        const query = `
          SELECT e.employee_id, e.employee_name AS name, u.username AS id,
                 d.department_name AS department, u.email, 'Active' AS status
          FROM employees e
          JOIN users u ON u.user_id = e.user_id
          LEFT JOIN departments d ON d.department_id = e.department_id
          ORDER BY e.employee_id ASC
        `;
        const [rows] = await pool.query(query);
        employees = rows.length > 0 ? rows.map(serializeEmployee) : memoryStore.employees.map(serializeEmployee);
      } catch (err) {
        employees = memoryStore.employees.map(serializeEmployee);
      }
    }

    res.json(employees);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
