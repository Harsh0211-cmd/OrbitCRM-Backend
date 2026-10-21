const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a-super-secret-jwt-key-with-over-thirty-two-characters-2026';

const { app } = require('../index');
const { memoryStore } = require('../src/data/store');

function makeToken(role, name, dept = null, company = null, custId = null) {
  return jwt.sign(
    {
      userId: 1,
      id: `${role.toLowerCase()}.user`,
      name,
      role,
      department: dept,
      company,
      customerId: custId,
      email: `${role.toLowerCase()}@orbitcrm.test`
    },
    process.env.JWT_SECRET
  );
}

const customerToken = makeToken('Customer', 'Rahul Mehta', null, 'Acme Technologies', 1);
const salesToken = makeToken('Employee', 'Priya Nair', 'Sales');
const supportToken = makeToken('Employee', 'Ananya Das', 'IT Support');

describe('Phase 2 Business Automations (Rule AUTO 1-5)', () => {
  test('Automation 1: Service Request submission creates Request + Lead + Customer Notification', async () => {
    const initialLeadCount = memoryStore.leads.length;

    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        service: 'Website & Application Development',
        description: 'Need a mobile responsive portal with invoice export.',
        contact: 'Email'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, 'Service request submitted successfully');
    assert.ok(res.body.request.id.startsWith('R-'));
    assert.equal(res.body.request.status, 'Submitted');

    // 1. Verify linked Lead was created
    assert.equal(memoryStore.leads.length, initialLeadCount + 1);
    const createdLead = memoryStore.leads[0];
    assert.equal(createdLead.company, 'Acme Technologies');
    assert.equal(createdLead.source, 'Website');
    assert.equal(createdLead.status, 'New');
    assert.equal(createdLead.assigned, 'Priya Nair'); // Assigned to Sales
    assert.equal(createdLead.customerId, 1);

    // 2. Verify notification was created
    const latestNotif = memoryStore.notifications[0];
    assert.equal(latestNotif, 'Your service request has been received.');
  });

  test('Automation 2: Marking Lead as Won auto-creates Project in Not Started', async () => {
    // Create a new lead to transition
    const createRes = await request(app)
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        name: 'Siddharth Patel',
        company: 'Patel Enterprise',
        service: 'Website Development',
        status: 'Negotiation'
      });
    const leadId = createRes.body.lead.id;

    const initialProjectCount = memoryStore.projects.length;

    // Transition to Won
    const patchRes = await request(app)
      .patch(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'Won' });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.lead.status, 'Won');

    // Verify Project was created
    assert.equal(memoryStore.projects.length, initialProjectCount + 1);
    const newProject = memoryStore.projects[0];
    assert.equal(newProject.customer, 'Patel Enterprise');
    assert.equal(newProject.status, 'Not Started');
    assert.equal(newProject.progress, 0);
    assert.equal(newProject.assigned, 'Vikram Rao'); // Assigned to Dev
  });

  test('Automation 3: Escalating Ticket notifies Development and auto-creates Dev Task', async () => {
    const initialTaskCount = memoryStore.tasks.length;

    const patchRes = await request(app)
      .patch('/api/v1/tickets/T-102')
      .set('Authorization', `Bearer ${supportToken}`)
      .send({
        status: 'Escalated',
        latest: 'Escalated to core engineering team.'
      });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.ticket.status, 'Escalated');

    // Verify notification created
    const notif = memoryStore.notifications[0];
    assert.equal(notif, 'T-102 has been escalated to Development.');

    // Verify Task created for Development
    assert.equal(memoryStore.tasks.length, initialTaskCount + 1);
    const newTask = memoryStore.tasks[0];
    assert.equal(newTask.department, 'Development');
    assert.equal(newTask.assigned, 'Vikram Rao');
    assert.equal(newTask.related, 'T-102');
    assert.equal(newTask.priority, 'High');
    assert.equal(newTask.status, 'Pending');
  });

  test('Automation 4: Resolving Ticket notifies customer and admin', async () => {
    const patchRes = await request(app)
      .patch('/api/v1/tickets/T-102')
      .set('Authorization', `Bearer ${supportToken}`)
      .send({
        status: 'Resolved',
        latest: 'Fix deployed and verified.'
      });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.ticket.status, 'Resolved');

    // Verify notification created
    const notif = memoryStore.notifications[0];
    assert.equal(notif, 'T-102 has been resolved; awaiting customer confirmation.');
  });

  test('Automation 5: Adding a note attaches it to related entity and creates notification', async () => {
    const res = await request(app)
      .post('/api/v1/notes')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        related: 'L-101',
        note: 'Customer approved initial wireframes.'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, 'Note saved');

    // Check note appended to lead
    const lead = memoryStore.leads.find(l => l.id === 'L-101');
    assert.ok(lead.notes.includes('Customer approved initial wireframes.'));

    // Check notification
    const notif = memoryStore.notifications[0];
    assert.equal(notif, 'New note added by Priya Nair.');
  });
});
