const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a-super-secret-jwt-key-with-over-thirty-two-characters-2026';

const { app } = require('../index');
const contract = require('../contract.json');
const {
  serializeCustomer,
  serializeLead,
  serializeProject,
  serializeTicket,
  serializeTask,
  serializeServiceRequest,
  serializeEmployee,
  serializeDepartment,
  serializeNotification,
  serializeUserProfile
} = require('../src/serializers/toDto');

function makeAdminToken() {
  return jwt.sign(
    { userId: 1, id: 'admin.admin', name: 'Aarav Sharma', role: 'Admin', department: 'Admin' },
    process.env.JWT_SECRET
  );
}

describe('Contract Compliance & Serializer Tests (Rule C1-C3)', () => {
  const adminToken = makeAdminToken();

  test('Customer serializer outputs exact keys in exact contract order', () => {
    const raw = {
      customer_id: 1,
      customer_name: 'Rahul Mehta',
      company: 'Acme Technologies',
      email: 'rahul@acme.example',
      contact: '9876543214',
      status: 'Active',
      created_at: new Date('2026-09-12T00:00:00Z')
    };
    const dto = serializeCustomer(raw);
    const expectedOrder = contract.entities.Customer.fieldOrder;
    assert.deepEqual(Object.keys(dto), expectedOrder);
    assert.equal(dto.id, 1);
    assert.equal(dto.date, '12 Sep 2026');
  });

  test('Lead serializer handles optional customerId: present vs absent', () => {
    const expectedOrderWithOptional = contract.entities.Lead.fieldOrder;
    const expectedOrderWithoutOptional = contract.entities.Lead.fieldOrder.filter(k => k !== 'customerId');

    // With customerId
    const withOptional = serializeLead({
      id: 'L-101',
      name: 'Rahul Mehta',
      company: 'Acme Technologies',
      service: 'Website Development',
      source: 'Website',
      status: 'Requirement Discussion',
      assigned: 'Priya Nair',
      followup: '30 Sep 2026',
      customerId: 1,
      notes: ['Test note']
    });
    assert.deepEqual(Object.keys(withOptional), expectedOrderWithOptional);
    assert.equal(withOptional.customerId, 1);

    // Without customerId (must be absent, never null)
    const withoutOptional = serializeLead({
      id: 'L-102',
      name: 'Jordan Lee',
      company: 'Nova Retail',
      service: 'IT Support & Maintenance',
      source: 'Referral',
      status: 'Quotation',
      assigned: 'Priya Nair',
      followup: '01 Oct 2026',
      customerId: null,
      notes: []
    });
    assert.deepEqual(Object.keys(withoutOptional), expectedOrderWithoutOptional);
    assert.equal(Object.prototype.hasOwnProperty.call(withoutOptional, 'customerId'), false);
    assert.notEqual(withoutOptional.customerId, null); // absent, not null
  });

  test('Project serializer outputs exact keys in exact contract order', () => {
    const raw = {
      id: 'P-101',
      name: 'Acme Business Website',
      customer: 'Acme Technologies',
      customerId: 1,
      service: 'Website Development',
      assigned: 'Vikram Rao',
      status: 'Development',
      priority: 'High',
      deadline: '15 Oct 2026',
      progress: 60,
      updates: ['Working']
    };
    const dto = serializeProject(raw);
    assert.deepEqual(Object.keys(dto), contract.entities.Project.fieldOrder);
  });

  test('Ticket serializer outputs exact keys in exact contract order', () => {
    const raw = {
      id: 'T-102',
      customer: 'Acme Technologies',
      customerId: 1,
      subject: 'Contact form not working',
      priority: 'High',
      assigned: 'Ananya Das',
      status: 'In Progress',
      created: '25 Sep 2026',
      due: '30 Sep 2026',
      latest: 'Investigating',
      notes: []
    };
    const dto = serializeTicket(raw);
    assert.deepEqual(Object.keys(dto), contract.entities.Ticket.fieldOrder);
  });

  test('Task serializer outputs exact keys in exact contract order', () => {
    const raw = {
      id: 1,
      title: 'Follow up on Acme requirements',
      department: 'Sales',
      assigned: 'Priya Nair',
      related: 'L-101',
      priority: 'High',
      due: '30 Sep 2026',
      status: 'Pending'
    };
    const dto = serializeTask(raw);
    assert.deepEqual(Object.keys(dto), contract.entities.Task.fieldOrder);
  });

  test('ServiceRequest serializer outputs exact keys in exact contract order', () => {
    const raw = {
      id: 'R-101',
      customerId: 1,
      service: 'Website & Application Development',
      description: 'Business website',
      contact: 'Email',
      date: '21 Sep 2026',
      status: 'Requirement Discussion',
      assigned: 'Priya Nair'
    };
    const dto = serializeServiceRequest(raw);
    assert.deepEqual(Object.keys(dto), contract.entities.ServiceRequest.fieldOrder);
  });

  test('UserProfile serializer omits optional fields when absent, never null', () => {
    // Admin with department, no company or customerId
    const adminUser = {
      id: 'admin.admin',
      name: 'Aarav Sharma',
      role: 'Admin',
      department: 'Admin',
      email: 'admin@orbitcrm.test'
    };
    const adminDto = serializeUserProfile(adminUser);
    assert.equal(adminDto.id, 'admin.admin');
    assert.equal(adminDto.department, 'Admin');
    assert.equal(Object.prototype.hasOwnProperty.call(adminDto, 'company'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(adminDto, 'customerId'), false);

    // Customer with company and customerId, no department
    const custUser = {
      id: 'customer.user',
      name: 'Rahul Mehta',
      role: 'Customer',
      company: 'Acme Technologies',
      customerId: 1,
      email: 'rahul@acme.example',
      phone: '9876543214'
    };
    const custDto = serializeUserProfile(custUser);
    assert.equal(custDto.role, 'Customer');
    assert.equal(custDto.company, 'Acme Technologies');
    assert.equal(custDto.customerId, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(custDto, 'department'), false);
  });

  test('GET /api/v1/customers returns records matching contract key order', async () => {
    const res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    for (const record of res.body) {
      assert.deepEqual(Object.keys(record), contract.entities.Customer.fieldOrder);
    }
  });

  test('GET /api/v1/leads returns records matching contract key order', async () => {
    const res = await request(app)
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    for (const record of res.body) {
      if (record.customerId !== undefined) {
        assert.deepEqual(Object.keys(record), contract.entities.Lead.fieldOrder);
      } else {
        const withoutCustId = contract.entities.Lead.fieldOrder.filter(k => k !== 'customerId');
        assert.deepEqual(Object.keys(record), withoutCustId);
      }
    }
  });

  test('GET /api/v1/projects returns records matching contract key order', async () => {
    const res = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    for (const record of res.body) {
      assert.deepEqual(Object.keys(record), contract.entities.Project.fieldOrder);
    }
  });

  test('GET /api/v1/tickets returns records matching contract key order', async () => {
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    for (const record of res.body) {
      assert.deepEqual(Object.keys(record), contract.entities.Ticket.fieldOrder);
    }
  });

  test('GET /api/v1/tasks returns records matching contract key order', async () => {
    const res = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    for (const record of res.body) {
      assert.deepEqual(Object.keys(record), contract.entities.Task.fieldOrder);
    }
  });

  test('GET /api/v1/requests returns records matching contract key order', async () => {
    const res = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    for (const record of res.body) {
      assert.deepEqual(Object.keys(record), contract.entities.ServiceRequest.fieldOrder);
    }
  });

  test('GET /api/v1/bootstrap returns expected aggregated shape', async () => {
    const res = await request(app)
      .get('/api/v1/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    const expectedKeys = [
      'user',
      'customers',
      'leads',
      'projects',
      'tickets',
      'tasks',
      'requests',
      'issues',
      'notifications'
    ];
    assert.deepEqual(Object.keys(res.body), expectedKeys);
  });
});
