const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { serializeDepartment } = require('../serializers/toDto');
const { memoryStore, isTestMode } = require('../data/store');
const { pool } = require('../config/db');

const router = express.Router();
router.use(authenticate);
router.use(authorize('Admin'));

// GET /api/v1/departments (Admin only)
router.get('/', async (req, res, next) => {
  try {
    let departments = [];
    if (isTestMode()) {
      departments = memoryStore.departments.map(d => serializeDepartment(d, d.employees));
    } else {
      try {
        const query = `
          SELECT d.department_id, d.department_name AS name,
                 COUNT(e.employee_id) AS employees
          FROM departments d
          LEFT JOIN employees e ON e.department_id = d.department_id
          GROUP BY d.department_id, d.department_name
          ORDER BY d.department_id ASC
        `;
        const [rows] = await pool.query(query);
        departments = rows.length > 0
          ? rows.map(r => serializeDepartment(r, r.employees))
          : memoryStore.departments.map(d => serializeDepartment(d, d.employees));
      } catch (err) {
        departments = memoryStore.departments.map(d => serializeDepartment(d, d.employees));
      }
    }

    res.json(departments);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
