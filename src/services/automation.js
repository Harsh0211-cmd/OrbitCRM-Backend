const {
  memoryStore,
  nextLeadId,
  nextProjectId,
  nextTaskId
} = require('../data/store');
const { formatDate } = require('../serializers/date');

function recordEvent(type, data, targetAudience = ['Admin']) {
  const event = {
    id: memoryStore.events.length + 1,
    type,
    data,
    targetAudience,
    timestamp: new Date().toISOString()
  };
  memoryStore.events.push(event);
  return event;
}

function handleServiceRequestCreated(request, customerUser) {
  // 1. Create linked Lead
  const followupDate = new Date();
  followupDate.setDate(followupDate.getDate() + 2);

  const linkedLead = {
    id: nextLeadId(),
    name: customerUser.name,
    company: customerUser.company,
    service: request.service,
    source: 'Website',
    status: 'New',
    assigned: 'Priya Nair', // Least-loaded Sales
    followup: formatDate(followupDate),
    customerId: customerUser.customerId || 1,
    notes: []
  };
  memoryStore.leads.unshift(linkedLead);

  // 2. Add notification for customer
  const notifMsg = 'Your service request has been received.';
  memoryStore.notifications.unshift(notifMsg);

  recordEvent('SERVICE_REQUEST_CREATED', { requestId: request.id, leadId: linkedLead.id }, ['Admin', 'Sales', 'Customer']);
  return { linkedLead, notifMsg };
}

function handleLeadWon(lead) {
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + 15);

  const newProject = {
    id: nextProjectId(),
    name: `${lead.company} Delivery Project`,
    customer: lead.company,
    customerId: lead.customerId || 1,
    service: lead.service || 'Website Development',
    assigned: 'Vikram Rao', // Least-loaded Dev
    status: 'Not Started',
    priority: 'Medium',
    deadline: formatDate(deadlineDate),
    progress: 0,
    updates: []
  };
  memoryStore.projects.unshift(newProject);

  recordEvent('PROJECT_CREATED_FROM_LEAD', { leadId: lead.id, projectId: newProject.id }, ['Admin', 'Development', 'Customer']);
  return newProject;
}

function handleTicketEscalated(ticket) {
  const notifMsg = `${ticket.id} has been escalated to Development.`;
  memoryStore.notifications.unshift(notifMsg);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);

  const devTask = {
    id: nextTaskId(),
    title: `Investigate escalated ${ticket.id}`,
    department: 'Development',
    assigned: 'Vikram Rao',
    related: ticket.id,
    priority: 'High',
    due: formatDate(dueDate),
    status: 'Pending'
  };
  memoryStore.tasks.unshift(devTask);

  recordEvent('TICKET_ESCALATED', { ticketId: ticket.id, taskId: devTask.id }, ['Admin', 'Development', 'IT Support']);
  return { notifMsg, devTask };
}

function handleTicketResolved(ticket) {
  const notifMsg = `${ticket.id} has been resolved; awaiting customer confirmation.`;
  memoryStore.notifications.unshift(notifMsg);

  recordEvent('TICKET_RESOLVED', { ticketId: ticket.id }, ['Admin', 'IT Support', 'Customer']);
  return { notifMsg };
}

function handleNoteAdded(relatedId, noteText, authorName) {
  const notifMsg = `New note added by ${authorName}.`;
  memoryStore.notifications.unshift(notifMsg);

  // Append note to target entity if found in memoryStore
  const lead = memoryStore.leads.find(l => l.id === relatedId || String(l.id) === String(relatedId));
  if (lead) {
    lead.notes = lead.notes || [];
    lead.notes.push(noteText);
  }

  const project = memoryStore.projects.find(p => p.id === relatedId || String(p.id) === String(relatedId));
  if (project) {
    project.updates = project.updates || [];
    project.updates.push(noteText);
  }

  const ticket = memoryStore.tickets.find(t => t.id === relatedId || String(t.id) === String(relatedId));
  if (ticket) {
    ticket.notes = ticket.notes || [];
    ticket.notes.push(noteText);
  }

  recordEvent('NOTE_ADDED', { relatedId, note: noteText, author: authorName }, ['Admin', 'Employee']);
  return { notifMsg };
}

module.exports = {
  recordEvent,
  handleServiceRequestCreated,
  handleLeadWon,
  handleTicketEscalated,
  handleTicketResolved,
  handleNoteAdded
};
