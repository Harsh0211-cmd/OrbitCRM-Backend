const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a-super-secret-jwt-key-with-over-thirty-two-characters-2026';

const { app } = require('../index');
const { validateEnv } = require('../src/config/env');
const { checkDbConnection, sanitizeErrorMessage } = require('../src/config/db');

describe('Security & Secret Handling Tests (Rule S1-S5, DB3)', () => {
  test('validateEnv throws if JWT_SECRET is missing', () => {
    assert.throws(
      () => validateEnv({ JWT_SECRET: '' }),
      /JWT_SECRET must be defined/
    );
  });

  test('validateEnv throws if JWT_SECRET is shorter than 32 characters', () => {
    assert.throws(
      () => validateEnv({ JWT_SECRET: 'short-secret' }),
      /JWT_SECRET must be at least 32 characters long/
    );
  });

  test('validateEnv throws if JWT_SECRET is a known default in non-development', () => {
    assert.throws(
      () => validateEnv({
        JWT_SECRET: '12345678901234567890123456789012',
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: 'https://orbitcrm.example.com'
      }),
      /JWT_SECRET cannot use a known default secret in production\/test/
    );
  });

  test('validateEnv throws if FRONTEND_ORIGIN is * or missing outside development (Rule S5)', () => {
    assert.throws(
      () => validateEnv({
        JWT_SECRET: 'a-super-secret-jwt-key-with-over-thirty-two-characters-2026',
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: '*'
      }),
      /FRONTEND_ORIGIN cannot be '\*' outside development/
    );
  });

  test('validateTestDatabaseIsolation throws if TEST_DATABASE_URL equals DATABASE_URL (Rule DB8)', () => {
    const { validateTestDatabaseIsolation } = require('../src/config/env');
    assert.throws(
      () => validateTestDatabaseIsolation({
        DATABASE_URL: 'postgres://user:pass@host:5432/db',
        TEST_DATABASE_URL: 'postgres://user:pass@host:5432/db'
      }),
      /TEST_DATABASE_URL cannot equal DATABASE_URL/
    );
  });

  test('Database connection error sanitization strips passwords and connection strings', () => {
    const rawError = 'Access denied for user root@localhost with password superSecretPassword123';
    const sanitized = sanitizeErrorMessage(rawError, 'superSecretPassword123');
    assert.ok(!sanitized.includes('superSecretPassword123'));
    assert.ok(sanitized.includes('***'));

    // URL format sanitization
    const urlError = 'Failed to connect to postgresql://postgres:mySecretPass@db.host.com:5432/dbname';
    const sanitizedUrl = sanitizeErrorMessage(urlError, 'mySecretPass');
    assert.ok(!sanitizedUrl.includes('mySecretPass'));
  });

  test('Unknown /api/v1/** routes return JSON error envelope, not HTML (Rule F2)', async () => {
    const res = await request(app).get('/api/v1/non-existent-endpoint-xyz');
    assert.equal(res.status, 404);
    assert.equal(res.headers['content-type'].includes('application/json'), true);
    assert.ok(res.body.error);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  test('Login with invalid credentials returns 401 with exact contract error message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ id: 'admin.admin', password: 'wrongpassword' });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(res.body.error.message, 'Invalid Login ID or Password.');
  });

  test('Login with valid credentials returns JWT token and sanitized user profile (Rule S2)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ id: 'admin.admin', password: 'admin123' });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.user);

    // Rule S2: Scan response body for password hashes or passwords
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes('password_hash'));
    assert.ok(!bodyStr.includes('$2a$'));
    assert.ok(!bodyStr.includes('$2b$'));
    assert.ok(!bodyStr.includes('admin123'));
  });

  test('Response scanner: No response body across read endpoints leaks password hashes', async () => {
    const token = jwt.sign(
      { userId: 1, id: 'admin.admin', name: 'Aarav Sharma', role: 'Admin', department: 'Admin' },
      process.env.JWT_SECRET
    );

    const endpoints = [
      '/api/v1/customers',
      '/api/v1/leads',
      '/api/v1/projects',
      '/api/v1/tickets',
      '/api/v1/tasks',
      '/api/v1/requests',
      '/api/v1/employees',
      '/api/v1/departments',
      '/api/v1/dashboard',
      '/api/v1/notifications',
      '/api/v1/bootstrap'
    ];

    for (const ep of endpoints) {
      const res = await request(app)
        .get(ep)
        .set('Authorization', `Bearer ${token}`);

      const bodyStr = JSON.stringify(res.body);
      assert.ok(!bodyStr.includes('password_hash'), `Endpoint ${ep} leaked password_hash`);
      assert.ok(!bodyStr.includes('$2b$'), `Endpoint ${ep} leaked bcrypt hash`);
      assert.ok(!bodyStr.includes('$2a$'), `Endpoint ${ep} leaked bcrypt hash`);
    }
  });
});
