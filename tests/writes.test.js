const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a-super-secret-jwt-key-with-over-thirty-two-characters-2026';

const { app } = require('../index');

function makeToken(role, name, dept = null, company = null, custId = null, email = 'user@example.test') {
  return jwt.sign(
    {
      userId: 1,
      id: `${role.toLowerCase()}.user`,
      name,
      role,
      department: dept,
      company,
      customerId: custId,
      email
    },
    process.env.JWT_SECRET
  );
}

const adminToken = makeToken('Admin', 'Aarav Sharma', 'Admin');
const salesToken = makeToken('Employee', 'Priya Nair', 'Sales');
const devToken = makeToken('Employee', 'Vikram Rao', 'Development');
const supportToken = makeToken('Employee', 'Ananya Das', 'IT Support');
const customerToken = makeToken('Customer', 'Rahul Mehta', null, 'Acme Technologies', 1, 'rahul@acme.example');

describe('Phase 2 Write Operations & Validations', () => {
  // 1. Registration tests
  test('Customer registration succeeds and returns exact contract toast message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Suresh Raina',
        company: 'Raina Infotech',
        email: 'suresh@raina.example',
        phone: '9988776655',
        password: 'password123',
        confirm: 'password123'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, 'Registration successful. You can now sign in.');
    assert.ok(res.body.customerId);

    // Verify user can now log in
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ id: 'suresh@raina.example', password: 'password123' });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.role, 'Customer');
    assert.equal(loginRes.body.user.name, 'Suresh Raina');
  });

  test('Registration rejects duplicate email with exact contract message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Duplicate Test',
        company: 'Dup Corp',
        email: 'rahul@acme.example', // already exists in demo accounts
        phone: '1234567890',
        password: 'password123',
        confirm: 'password123'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'DUPLICATE_EMAIL');
    assert.equal(res.body.error.message, 'An account with this email already exists.');
  });

  test('Registration rejects password mismatch with exact contract message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Mismatch Test',
        company: 'Mismatch Corp',
        email: 'mismatch@example.com',
        phone: '1234567890',
        password: 'password123',
        confirm: 'different123'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(res.body.error.message, 'Passwords do not match.');
  });

  // 2. Profile update (PATCH /api/v1/auth/me)
  test('Profile update modifies name and phone while keeping email immutable', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Rahul Mehta Updated',
        phone: '9999999999',
        email: 'hacker@malicious.com' // attempted email mutation
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Profile updated successfully');
    assert.equal(res.body.user.name, 'Rahul Mehta Updated');
    assert.equal(res.body.user.phone, '9999999999');
    assert.equal(res.body.user.email, 'rahul@acme.example'); // must NOT change
  });

  // 3. Lead Creation & Status Update
  test('Sales can create a lead with exact toast message', async () => {
    const res = await request(app)
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        name: 'Rohan Verma',
        company: 'Verma Logistics',
        service: 'Website Development',
        status: 'New'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, 'Record created');
    assert.ok(res.body.lead.id.startsWith('L-'));
    assert.equal(res.body.lead.company, 'Verma Logistics');
  });

  test('Sales can update lead status with exact toast message', async () => {
    const res = await request(app)
      .patch('/api/v1/leads/L-101')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'Qualified' });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Status updated');
    assert.equal(res.body.lead.status, 'Qualified');
  });

  // 4. Project Creation & Progress Update
  test('Admin can create a project; Dev cannot create a project', async () => {
    const devAttempt = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ name: 'Portal Redesign', customer: 'Acme Technologies' });
    assert.equal(devAttempt.status, 403);

    const adminRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Portal Redesign', customer: 'Acme Technologies', progress: 10 });

    assert.equal(adminRes.status, 201);
    assert.equal(adminRes.body.message, 'Record created');
    assert.ok(adminRes.body.project.id.startsWith('P-'));
    assert.equal(adminRes.body.project.progress, 10);
  });

  test('Development can update project progress and status (clamped 0-100)', async () => {
    const res = await request(app)
      .patch('/api/v1/projects/P-101')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ progress: 85, status: 'Testing' });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Status updated');
    assert.equal(res.body.project.progress, 85);
    assert.equal(res.body.project.status, 'Testing');

    // Completing project forces progress to 100
    const completeRes = await request(app)
      .patch('/api/v1/projects/P-101')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ status: 'Completed', progress: 50 });

    assert.equal(completeRes.body.project.status, 'Completed');
    assert.equal(completeRes.body.project.progress, 100);
  });

  // 5. Ticket Creation & Update
  test('Customer can create a support ticket', async () => {
    const res = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        subject: 'Database latency issue',
        description: 'Queries are timing out in the morning hours.',
        priority: 'High'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, 'Record created');
    assert.ok(res.body.ticket.id.startsWith('T-'));
    assert.equal(res.body.ticket.customer, 'Acme Technologies');
  });

  // 6. Tasks, Issues, Notes
  test('Developer can report technical issue', async () => {
    const res = await request(app)
      .post('/api/v1/issues')
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        title: 'Auth token expiration bug',
        related: 'P-101',
        priority: 'High',
        description: 'Token expires earlier than expected.'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, 'Issue reported');
    assert.ok(res.body.issue.id.startsWith('I-'));
  });

  test('Employee can save a note; Customer is forbidden', async () => {
    const custRes = await request(app)
      .post('/api/v1/notes')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ related: 'L-101', note: 'Customer note attempt' });
    assert.equal(custRes.status, 403);

    const empRes = await request(app)
      .post('/api/v1/notes')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ related: 'L-101', note: 'Client requested demo call on Monday.' });
    assert.equal(empRes.status, 201);
    assert.equal(empRes.body.message, 'Note saved');
  });

  // 7. Settings, Reports, Notifications, Search, Events
  test('Admin can update settings and clear notifications', async () => {
    const settRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyName: 'Orbit Solutions India', notificationPreference: 'Important only' });

    assert.equal(settRes.status, 200);
    assert.equal(settRes.body.message, 'Settings saved');
    assert.equal(settRes.body.settings.companyName, 'Orbit Solutions India');

    const clearRes = await request(app)
      .post('/api/v1/notifications/clear')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(clearRes.status, 200);
    assert.equal(clearRes.body.message, 'Notifications cleared');
  });

  test('Admin reports summary returns aggregations', async () => {
    const res = await request(app)
      .get('/api/v1/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.leadStatus);
    assert.ok(res.body.projectStatus);
    assert.ok(res.body.ticketStatus);
    assert.ok(res.body.tasksByDept);
  });

  test('Global search returns scoped multi-entity matches', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=Acme')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });

  test('Live events cursor returns events stream', async () => {
    const res = await request(app)
      .get('/api/v1/events')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.cursor);
    assert.ok(Array.isArray(res.body.events));
  });
});
