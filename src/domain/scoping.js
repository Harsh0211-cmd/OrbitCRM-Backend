/**
 * Determines whether a given entity record is accessible by the user.
 * Implements the contract scoping policy:
 * - Admin: full visibility.
 * - Customer: accessible if record customerId matches user customerId OR record customer matches user company.
 * - Employee: accessible if assigned matches user name OR department matches user department.
 */
function isRecordAccessible(record, user, assignedKey = 'assigned') {
  if (!user) return false;
  if (user.role === 'Admin') return true;

  if (user.role === 'Customer') {
    const custId = record.customerId || record.customer_id;
    const custName = record.customer || record.company || record.company_name;
    const matchesId = custId != null && user.customerId != null && Number(custId) === Number(user.customerId);
    const matchesCompany = custName && user.company && String(custName).trim().toLowerCase() === String(user.company).trim().toLowerCase();
    return Boolean(matchesId || matchesCompany);
  }

  // Employee
  const assigned = record[assignedKey] || record.assigned;
  const dept = record.department;

  const matchesAssigned = assigned && user.name && String(assigned).trim().toLowerCase() === String(user.name).trim().toLowerCase();
  const matchesDept = dept && user.department && String(dept).trim().toLowerCase() === String(user.department).trim().toLowerCase();

  // If department isn't present on entity (e.g. Lead, Project, Ticket), match assigned or portal role
  if (matchesAssigned || matchesDept) return true;

  // Department-specific module access
  if (user.department === 'Sales' && (record.source || record.lead_code || record.id?.toString().startsWith('L-'))) {
    return true; // Sales can view leads
  }
  if (user.department === 'Development' && (record.progress !== undefined || record.project_code || record.id?.toString().startsWith('P-'))) {
    return true; // Dev can view projects
  }
  if (user.department === 'IT Support' && (record.latest !== undefined || record.ticket_code || record.id?.toString().startsWith('T-'))) {
    return true; // IT Support can view tickets
  }

  return false;
}

function filterScoped(records, user, assignedKey = 'assigned') {
  if (user.role === 'Admin') return records;
  return records.filter(r => isRecordAccessible(r, user, assignedKey));
}

module.exports = {
  isRecordAccessible,
  filterScoped
};
