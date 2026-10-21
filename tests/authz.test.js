const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a-super-secret-jwt-key-with-over-thirty-two-characters-2026';

const { app } = require('../index');

function makeToken(account) {
  return jwt.sign(
    {
      userId: account.id === 'customer.user' ? 5 : 1,
      id: account.id,
      name: account.name,
      role: account.role,
      department: account.department || null,
      company: account.company || null,
      customerId: account.role === 'Customer' ? 1 : null,
      email: account.email
    },
    process.env.JWT_SECRET
  );
}

const accounts = {
  admin: { id: 'admin.admin', name: 'Aarav Sharma', role: 'Admin', department: 'Admin', email: 'admin@orbitcrm.test' },
  sales: { id: 'sales.emp', name: 'Priya Nair', role: 'Employee', department: 'Sales', email: 'priya@orbitcrm.test' },
  developer: { id: 'developer.emp', name: 'Vikram Rao', role: 'Employee', department: 'Development', email: 'vikram@orbitcrm.test' },
  support: { id: 'support.emp', name: 'Ananya Das', role: 'Employee', department: 'IT Support', email: 'ananya@orbitcrm.test' },
  customer: { id: 'customer.user', name: 'Rahul Mehta', role: 'Customer', company: 'Acme Technologies', customerId: 1, email: 'rahul@acme.example' }
};

const tokens = {
  admin: makeToken(accounts.admin),
  sales: makeToken(accounts.sales),
  developer: makeToken(accounts.developer),
  support: makeToken(accounts.support),
  customer: makeToken(accounts.customer)
};

describe('Authorization & Access Control Matrix Tests (Rule A1-A4)', () => {
  test('Unauthenticated request to protected route returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/customers');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  const matrix = [
    // Endpoint, Admin, Sales, Dev, Support, Customer
    { path: '/api/v1/leads', admin: 200, sales: 200, developer: 403, support: 403, customer: 403 },
    { path: '/api/v1/projects', admin: 200, sales: 403, developer: 200, support: 403, customer: 200 },
    { path: '/api/v1/tickets', admin: 200, sales: 403, developer: 200, support: 200, customer: 200 },
    { path: '/api/v1/tasks', admin: 200, sales: 200, developer: 200, support: 200, customer: 403 },
    { path: '/api/v1/requests', admin: 200, sales: 200, developer: 403, support: 403, customer: 200 },
    { path: '/api/v1/employees', admin: 200, sales: 403, developer: 403, support: 403, customer: 403 },
    { path: '/api/v1/departments', admin: 200, sales: 403, developer: 403, support: 403, customer: 403 }
  ];

  for (const row of matrix) {
    for (const [roleKey, expectedStatus] of Object.entries(row)) {
      if (roleKey === 'path') continue;
      test(`${roleKey.toUpperCase()} -> GET ${row.path} expects HTTP ${expectedStatus}`, async () => {
        const res = await request(app)
          .get(row.path)
          .set('Authorization', `Bearer ${tokens[roleKey]}`);

        assert.equal(res.status, expectedStatus, `Expected ${expectedStatus} for ${roleKey} on ${row.path}`);
        if (expectedStatus === 403) {
          assert.equal(res.body.error.code, 'FORBIDDEN');
        }
      });
    }
  }

  // Cross-user record access tests (Rule A3: Out-of-scope record produces 404, not 403, with zero leakage)
  test('Customer cannot read another customer record -> returns 404 Not Found', async () => {
    // Customer Rahul Mehta (customerId: 1) attempts to read Customer 2 (Horizon Ltd)
    const res = await request(app)
      .get('/api/v1/customers/2')
      .set('Authorization', `Bearer ${tokens.customer}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.equal(res.body.error.message, 'Customer not found');
  });

  test('Customer can read own customer record -> returns 200', async () => {
    const res = await request(app)
      .get('/api/v1/customers/1')
      .set('Authorization', `Bearer ${tokens.customer}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, 1);
    assert.equal(res.body.name, 'Rahul Mehta');
  });

  test('Customer cannot read ticket belonging to another customer -> returns 404', async () => {
    // T-103 belongs to Horizon Ltd (customerId: 2)
    const res = await request(app)
      .get('/api/v1/tickets/T-103')
      .set('Authorization', `Bearer ${tokens.customer}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  test('Customer cannot read project belonging to another customer -> returns 404', async () => {
    // P-102 belongs to Horizon Ltd (customerId: 2)
    const res = await request(app)
      .get('/api/v1/projects/P-102')
      .set('Authorization', `Bearer ${tokens.customer}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
