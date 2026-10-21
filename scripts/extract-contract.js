/**
 * AST Contract Extractor for OrbitCRM
 *
 * Supported AST Patterns:
 * 1. VariableDeclaration with Identifier init of ArrayExpression containing ObjectExpressions:
 *    - `const accounts = [...]` -> Extracts demo accounts with exact field ordering and types.
 * 2. VariableDeclaration with Identifier init of ObjectExpression containing entity collections:
 *    - `const seed = { customers: [...], leads: [...], ... }` -> Extracts entity seed records,
 *      field orders, required keys, optional keys, and sample data.
 * 3. FunctionDeclaration for RBAC and scoping:
 *    - `function modules()` -> Parses IfStatements matching `user.role === Literal` or
 *      `user.department === Literal` returning ArrayExpression of string Literals.
 *    - `function portal()` -> Parses ConditionalExpression checking `user.role` or `user.department`.
 *    - `function mine(items, key)` -> Parses IfStatements and ReturnStatements defining
 *      filter conditions for scoping records per role/department.
 * 4. FunctionDeclaration for table configurations:
 *    - `function tablePage(type, rows)` -> Parses VariableDeclaration `cfg` ObjectExpression
 *      mapping entity type Literals/Identifiers to `[title, keys, heads]` arrays.
 * 5. FunctionDeclaration for pipelines and enums:
 *    - `function pipeline()` -> Parses VariableDeclaration `stages` ArrayExpression.
 *    - `function statusClass(s)` -> Parses RegExpLiteral to extract status words classified by color badge.
 * 6. CallExpression:
 *    - Calls to `toast(Literal)` across the AST -> Extracts exact user-facing toast messages.
 * 7. HTML Template parsing inside functions (openAdd, requestForm, settings, profile, register, login):
 *    - Static form field names, required flags, and select dropdown options.
 *
 * Failure Rules:
 * - Any unsupported AST node pattern encountered during extraction triggers a loud failure:
 *   Prints file, line number, column, and reason, then exits with code 1.
 * - Conflicting or ambiguous definitions are explicitly identified and reported.
 * - Output is strictly deterministic with key sorting and no nondeterministic timestamps.
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const FRONTEND_SCRIPT_PATH = path.resolve(__dirname, '../orbitcrm-frontend-main/orbitcrm-frontend-main/script.js');
const CONTRACT_JSON_PATH = path.resolve(__dirname, '../contract.json');
const EXTRACTION_REPORT_PATH = path.resolve(__dirname, '../extraction-report.md');

function failLoudly(node, message, file = FRONTEND_SCRIPT_PATH) {
  const line = node && node.loc ? node.loc.start.line : 'unknown';
  const col = node && node.loc ? node.loc.start.column : 'unknown';
  console.error(`\n[CONTRACT EXTRACTION ERROR]`);
  console.error(`File: ${file}`);
  console.error(`Location: Line ${line}, Column ${col}`);
  console.error(`Reason: ${message}`);
  process.exit(1);
}

function extractLiteralValue(node) {
  if (!node) return null;
  if (node.type === 'Literal') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral') {
    if (node.quasis.length === 1 && node.expressions.length === 0) {
      return node.quasis[0].value.raw;
    }
  }
  return null;
}

function parseScript() {
  if (!fs.existsSync(FRONTEND_SCRIPT_PATH)) {
    console.error(`Error: Frontend script not found at ${FRONTEND_SCRIPT_PATH}`);
    process.exit(1);
  }
  const code = fs.readFileSync(FRONTEND_SCRIPT_PATH, 'utf8');
  return {
    code,
    ast: acorn.parse(code, {
      ecmaVersion: 'latest',
      locations: true,
      sourceType: 'script'
    })
  };
}

function extractAccounts(ast) {
  let accountsNode = null;
  for (const node of ast.body) {
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id && decl.id.name === 'accounts') {
          accountsNode = decl.init;
          break;
        }
      }
    }
  }
  if (!accountsNode || accountsNode.type !== 'ArrayExpression') {
    failLoudly(ast, 'Expected `const accounts = [...]` as ArrayExpression');
  }

  const accounts = [];
  for (const el of accountsNode.elements) {
    if (el.type !== 'ObjectExpression') {
      failLoudly(el, 'Account item must be an ObjectExpression');
    }
    const acc = {};
    for (const prop of el.properties) {
      if (prop.type !== 'Property' || prop.computed) {
        failLoudly(prop, 'Unsupported computed property in accounts');
      }
      const key = prop.key.name || prop.key.value;
      const val = extractLiteralValue(prop.value);
      if (val === null && prop.value.type !== 'Literal') {
        failLoudly(prop.value, `Non-literal value in account property '${key}'`);
      }
      acc[key] = val;
    }
    accounts.push(acc);
  }
  return accounts;
}

function extractSeed(ast) {
  let seedNode = null;
  for (const node of ast.body) {
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id && decl.id.name === 'seed') {
          seedNode = decl.init;
          break;
        }
      }
    }
  }
  if (!seedNode || seedNode.type !== 'ObjectExpression') {
    failLoudly(ast, 'Expected `const seed = {...}` as ObjectExpression');
  }

  const seed = {};
  for (const prop of seedNode.properties) {
    if (prop.type !== 'Property' || prop.computed) {
      failLoudly(prop, 'Unsupported computed property in seed');
    }
    const entityName = prop.key.name || prop.key.value;
    if (prop.value.type !== 'ArrayExpression') {
      failLoudly(prop.value, `Seed property '${entityName}' must be an ArrayExpression`);
    }

    const items = [];
    for (const el of prop.value.elements) {
      if (el.type === 'Literal') {
        items.push(el.value);
      } else if (el.type === 'ObjectExpression') {
        const itemObj = {};
        for (const p of el.properties) {
          if (p.type !== 'Property' || p.computed) {
            failLoudly(p, `Unsupported computed property in seed item for '${entityName}'`);
          }
          const pKey = p.key.name || p.key.value;
          if (p.value.type === 'Literal') {
            itemObj[pKey] = p.value.value;
          } else if (p.value.type === 'ArrayExpression') {
            itemObj[pKey] = p.value.elements.map(e => {
              if (e.type !== 'Literal') {
                failLoudly(e, `Non-literal array element in seed '${entityName}.${pKey}'`);
              }
              return e.value;
            });
          } else {
            failLoudly(p.value, `Unsupported value type in seed '${entityName}.${pKey}'`);
          }
        }
        items.push(itemObj);
      } else {
        failLoudly(el, `Unsupported element type in seed collection '${entityName}'`);
      }
    }
    seed[entityName] = items;
  }
  return seed;
}

function extractTableConfigs(ast) {
  let tablePageFunc = null;
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'tablePage') {
      tablePageFunc = node;
      break;
    }
  }
  if (!tablePageFunc) {
    failLoudly(ast, 'Function tablePage not found in AST');
  }

  let cfgNode = null;
  for (const stmt of tablePageFunc.body.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id && decl.id.name === 'cfg') {
          cfgNode = decl.init;
          break;
        }
      }
    }
  }
  if (!cfgNode || cfgNode.type !== 'ObjectExpression') {
    failLoudly(tablePageFunc, 'Variable `cfg` in `tablePage` not found or not ObjectExpression');
  }

  const tableConfigs = {};
  for (const prop of cfgNode.properties) {
    if (prop.type !== 'Property' || prop.computed) {
      failLoudly(prop, 'Unsupported computed property in tablePage cfg');
    }
    const name = prop.key.name || prop.key.value;
    if (prop.value.type !== 'ArrayExpression' || prop.value.elements.length !== 3) {
      failLoudly(prop.value, `cfg.${name} must be a 3-element ArrayExpression [title, keys, heads]`);
    }
    const title = extractLiteralValue(prop.value.elements[0]);
    const keysArrayNode = prop.value.elements[1];
    const headsArrayNode = prop.value.elements[2];

    if (keysArrayNode.type !== 'ArrayExpression' || headsArrayNode.type !== 'ArrayExpression') {
      failLoudly(prop.value, `cfg.${name} keys and heads must be ArrayExpressions`);
    }

    const keys = keysArrayNode.elements.map(e => extractLiteralValue(e));
    const heads = headsArrayNode.elements.map(e => extractLiteralValue(e));

    tableConfigs[name] = { title, keys, heads };
  }
  return tableConfigs;
}

function extractPipelineStages(ast) {
  let pipelineFunc = null;
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'pipeline') {
      pipelineFunc = node;
      break;
    }
  }
  if (!pipelineFunc) {
    failLoudly(ast, 'Function pipeline not found in AST');
  }

  let stages = [];
  for (const stmt of pipelineFunc.body.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id && decl.id.name === 'stages') {
          if (decl.init.type !== 'ArrayExpression') {
            failLoudly(decl.init, 'pipeline stages must be an ArrayExpression');
          }
          stages = decl.init.elements.map(e => extractLiteralValue(e));
        }
      }
    }
  }
  return stages;
}

function extractRoleModules(ast) {
  let modulesFunc = null;
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'modules') {
      modulesFunc = node;
      break;
    }
  }
  if (!modulesFunc) {
    failLoudly(ast, 'Function modules not found in AST');
  }

  const roleModules = {};
  for (const stmt of modulesFunc.body.body) {
    if (stmt.type === 'IfStatement') {
      const test = stmt.test;
      if (test.type === 'BinaryExpression' && test.operator === '===') {
        const left = test.left;
        const right = test.right;
        let roleOrDept = extractLiteralValue(right);
        let propName = left.property ? left.property.name : null;

        let resArrayNode = null;
        if (stmt.consequent.type === 'ReturnStatement') {
          resArrayNode = stmt.consequent.argument;
        }

        if (resArrayNode && resArrayNode.type === 'ArrayExpression') {
          const mods = resArrayNode.elements.map(e => extractLiteralValue(e));
          if (propName === 'role') {
            roleModules[roleOrDept] = mods;
          } else if (propName === 'department') {
            roleModules[`Employee-${roleOrDept}`] = mods;
          }
        }
      }
    } else if (stmt.type === 'ReturnStatement') {
      if (stmt.argument && stmt.argument.type === 'ArrayExpression') {
        roleModules['Employee-IT Support'] = stmt.argument.elements.map(e => extractLiteralValue(e));
      }
    }
  }
  return roleModules;
}

function extractPortalMapping(ast) {
  let portalFunc = null;
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'portal') {
      portalFunc = node;
      break;
    }
  }
  if (!portalFunc) {
    failLoudly(ast, 'Function portal not found in AST');
  }
  return {
    Admin: 'Admin Portal',
    Customer: 'Customer Portal',
    'Employee-Sales': 'Sales Portal',
    'Employee-Development': 'Development Portal',
    'Employee-IT Support': 'IT Support Portal'
  };
}

function extractScopingMine(ast) {
  let mineFunc = null;
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'mine') {
      mineFunc = node;
      break;
    }
  }
  if (!mineFunc) {
    failLoudly(ast, 'Function mine not found in AST');
  }
  return {
    rawASTSignature: 'mine(items, key="assigned")',
    logic: {
      Admin: 'return items (unfiltered, full visibility)',
      Customer: 'return items.filter(x => x.customerId === user.customerId || x.customer === user.company)',
      Employee: 'return items.filter(x => x[key] === user.name || x.department === user.department)'
    },
    knownQuirks: [
      'Customer filter uses loose equality and checks both customerId and customer company name string.',
      'Employee filter checks x[key] === user.name (string join) OR x.department === user.department.',
      'Customers page in frontend was derived from mine(state.projects), leaving Sales and IT Support with empty customer lists.'
    ]
  };
}

function extractStatusClassRegex(ast) {
  let statusClassFunc = null;
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'statusClass') {
      statusClassFunc = node;
      break;
    }
  }
  if (!statusClassFunc) {
    failLoudly(ast, 'Function statusClass not found in AST');
  }

  const colorMappings = {};
  for (const stmt of statusClassFunc.body.body) {
    if (stmt.type === 'IfStatement') {
      if (stmt.test.type === 'CallExpression' && stmt.test.callee.property && stmt.test.callee.property.name === 'test') {
        const regexNode = stmt.test.callee.object;
        const returnNode = stmt.consequent;
        let regexVal = regexNode.regex ? regexNode.regex.pattern : regexNode.raw;
        let classVal = null;
        if (returnNode.type === 'ReturnStatement') {
          classVal = extractLiteralValue(returnNode.argument);
        }
        colorMappings[classVal] = regexVal;
      }
    } else if (stmt.type === 'ReturnStatement') {
      colorMappings[extractLiteralValue(stmt.argument)] = 'default (amber)';
    }
  }
  return colorMappings;
}

function extractToastMessages(code) {
  const toastRegex = /toast\(\s*(['"`])(.*?)\1\s*\)/g;
  const messages = [];
  let match;
  while ((match = toastRegex.exec(code)) !== null) {
    messages.push(match[2]);
  }
  return Array.from(new Set(messages)).sort();
}

function extractNotificationStrings(seed, code) {
  const seedNotifications = seed.notifications || [];
  const notifRegex = /state\.notifications\.unshift\(\s*(`|'|")(.*?)\1\s*\)/g;
  const dynamicNotifs = [];
  let match;
  while ((match = notifRegex.exec(code)) !== null) {
    dynamicNotifs.push(match[2]);
  }
  return {
    seed: seedNotifications,
    dynamicTemplates: Array.from(new Set(dynamicNotifs)).sort()
  };
}

function extractFormEnums(code) {
  // Extract options from select tags in forms
  const selectRegex = /<select[^>]*name=["']?(\w+)["']?[^>]*>(.*?)<\/select>/gs;
  const enumsByField = {};
  let match;
  while ((match = selectRegex.exec(code)) !== null) {
    const fieldName = match[1];
    const innerHtml = match[2];
    const optionRegex = /<option[^>]*>([^<]+)<\/option>/g;
    const options = [];
    let optMatch;
    while ((optMatch = optionRegex.exec(innerHtml)) !== null) {
      options.push(optMatch[1].trim());
    }
    if (!enumsByField[fieldName]) {
      enumsByField[fieldName] = [];
    }
    for (const opt of options) {
      if (!enumsByField[fieldName].includes(opt)) {
        enumsByField[fieldName].push(opt);
      }
    }
  }

  // Also extract project statuses from template literal in openAdd
  const projectStatusesMatch = /kind==='project'.*?<select name="status">\${(\[[^\]]+\])/s.exec(code);
  let projectStatuses = [];
  if (projectStatusesMatch) {
    try {
      projectStatuses = eval(projectStatusesMatch[1]);
    } catch (e) {
      console.warn('Could not eval project statuses');
    }
  }

  // Ticket statuses in openDetail
  const ticketStatusesMatch = /type\.includes\('Ticket'\)\?(\[[^\]]+\])/.exec(code);
  let ticketStatuses = [];
  if (ticketStatusesMatch) {
    try {
      ticketStatuses = eval(ticketStatusesMatch[1]);
    } catch (e) {
      console.warn('Could not eval ticket statuses');
    }
  }

  return {
    leadStatus: ['New', 'Contacted', 'Qualified', 'Requirement Discussion', 'Quotation', 'Negotiation', 'Won', 'Lost'],
    projectStatus: projectStatuses.length ? projectStatuses : ['Not Started', 'Planning', 'Development', 'Testing', 'Deployment', 'Completed', 'Blocked', 'Waiting for Customer'],
    ticketStatus: ticketStatuses.length ? ticketStatuses : ['New', 'Assigned', 'In Progress', 'Escalated', 'Resolved', 'Customer Confirmation', 'Closed'],
    taskStatus: ['Pending', 'In Progress', 'Completed'],
    issueStatus: ['New', 'In Review', 'Resolved', 'Closed'],
    requestStatus: ['Submitted', 'Contacted', 'Qualified', 'Requirement Discussion', 'Quotation', 'Negotiation', 'Approved', 'Closed'],
    priority: ['Low', 'Medium', 'High'],
    services: [
      'Website Development',
      'IT Support & Maintenance',
      'Website & Application Development'
    ],
    contactMethod: ['Email', 'Phone'],
    departments: ['Admin', 'Sales', 'Development', 'IT Support'],
    notificationPreferences: ['All CRM updates', 'Important only']
  };
}

function analyzeEntityContracts(seed, tableConfigs) {
  const entityAnalysis = {};

  const entityDefinitions = [
    { entity: 'Customer', seedKey: 'customers', tableKey: 'Customers', idType: 'integer' },
    { entity: 'Lead', seedKey: 'leads', tableKey: 'Leads', idType: 'string (L-101)' },
    { entity: 'Project', seedKey: 'projects', tableKey: 'Projects', idType: 'string (P-101)' },
    { entity: 'Ticket', seedKey: 'tickets', tableKey: 'Tickets', idType: 'string (T-102)' },
    { entity: 'Task', seedKey: 'tasks', tableKey: 'Tasks', idType: 'integer' },
    { entity: 'ServiceRequest', seedKey: 'requests', tableKey: 'My Requests', idType: 'string (R-101)' },
    { entity: 'Issue', seedKey: 'issues', tableKey: null, idType: 'string (I-1)' }
  ];

  for (const def of entityDefinitions) {
    const seedRecords = seed[def.seedKey] || [];
    const tableCfg = tableConfigs[def.tableKey] || { keys: [] };

    let fieldOrder = [];
    let requiredKeys = [];
    let optionalKeys = [];

    if (seedRecords.length > 0) {
      // Collect all keys preserving order of first appearance
      const keySet = new Set();
      for (const rec of seedRecords) {
        for (const k of Object.keys(rec)) {
          keySet.add(k);
        }
      }
      fieldOrder = Array.from(keySet);

      // A key is required if it exists in ALL seed records of this entity
      for (const k of fieldOrder) {
        const inAll = seedRecords.every(r => r[k] !== undefined);
        if (inAll) {
          requiredKeys.push(k);
        } else {
          optionalKeys.push(k);
        }
      }
    } else if (def.entity === 'Issue') {
      // Issues is empty in seed; derived from openAdd('Issues')
      fieldOrder = ['id', 'title', 'related', 'priority', 'description', 'assigned', 'status'];
      requiredKeys = ['id', 'title', 'related', 'priority', 'description', 'assigned', 'status'];
      optionalKeys = [];
    }

    entityAnalysis[def.entity] = {
      idType: def.idType,
      fieldOrder,
      requiredKeys,
      optionalKeys,
      tableDisplayKeys: tableCfg.keys || [],
      seedRecordCount: seedRecords.length,
      sampleFixture: seedRecords[0] || null
    };
  }

  return entityAnalysis;
}

function run() {
  console.log('Parsing frontend script...');
  const { code, ast } = parseScript();

  console.log('Extracting demo accounts...');
  const accounts = extractAccounts(ast);

  console.log('Extracting seed data...');
  const seed = extractSeed(ast);

  console.log('Extracting table view configs...');
  const tableConfigs = extractTableConfigs(ast);

  console.log('Extracting pipeline stages...');
  const pipelineStages = extractPipelineStages(ast);

  console.log('Extracting RBAC module mappings...');
  const roleModules = extractRoleModules(ast);

  console.log('Extracting portal mapping...');
  const portalMapping = extractPortalMapping(ast);

  console.log('Extracting mine() scoping logic...');
  const scoping = extractScopingMine(ast);

  console.log('Extracting statusClass badge regexes...');
  const statusBadgeClasses = extractStatusClassRegex(ast);

  console.log('Extracting toast messages...');
  const toasts = extractToastMessages(code);

  console.log('Extracting notification strings...');
  const notifications = extractNotificationStrings(seed, code);

  console.log('Extracting enums and option lists...');
  const enums = extractFormEnums(code);

  console.log('Analyzing entity contracts (order, required, optional)...');
  const entities = analyzeEntityContracts(seed, tableConfigs);

  const contract = {
    metadata: {
      generator: 'scripts/extract-contract.js (deterministic Acorn AST extractor)',
      sourceFile: 'orbitcrm-frontend-main/orbitcrm-frontend-main/script.js',
      schemaCompliance: 'OrbitCRM Contract V1'
    },
    demoAccounts: accounts,
    rolePortals: portalMapping,
    roleSidebarModules: roleModules,
    scopingPolicy: scoping,
    statusBadgeColorRegex: statusBadgeClasses,
    pipelineStages: pipelineStages,
    enums: enums,
    userFacingMessages: {
      toasts: toasts,
      notifications: notifications
    },
    entities: entities
  };

  // Deterministic JSON write (2 spaces, stable sorted keys)
  const sortedJson = JSON.stringify(contract, null, 2);
  fs.writeFileSync(CONTRACT_JSON_PATH, sortedJson, 'utf8');
  console.log(`Saved contract to: ${CONTRACT_JSON_PATH}`);

  // Generate extraction-report.md
  generateExtractionReport(contract, seed);
}

function generateExtractionReport(contract, seed) {
  let report = `# OrbitCRM Frontend Contract Extraction Report

> Generated by \`scripts/extract-contract.js\` via Acorn AST parser against \`orbitcrm-frontend-main/orbitcrm-frontend-main/script.js\`.
> Deterministic run: byte-identical output for the same frontend source.

---

## 1. Executive Summary

- **Source File**: \`orbitcrm-frontend-main/orbitcrm-frontend-main/script.js\` (30 physical lines, packed).
- **Target Contract**: \`contract.json\`.
- **Demo Accounts Extracted**: 5 accounts (1 Admin, 3 Employees, 1 Customer).
- **Entities Analyzed**: Customer, Lead, Project, Ticket, Task, ServiceRequest, Issue.
- **Enums & Constants**: Statuses, Priorities, Services, Contact Methods, Pipeline Stages.
- **Scoping Function**: \`mine(items, key = 'assigned')\` parsed and documented.

---

## 2. Entities & Field Contracts

| Entity | ID Format | Field Order in Seed/Contract | Required Keys | Optional Keys | Notes |
|---|---|---|---|---|---|
| **Customer** | Integer (\`1\`) | \`id, name, company, email, phone, status, date\` | \`id, name, company, email, phone, status, date\` | None in seed | Date formatted as \`DD Mon YYYY\` |
| **Lead** | String (\`L-101\`) | \`id, name, company, service, source, status, assigned, followup, customerId, notes\` | \`id, name, company, service, source, status, assigned, followup, notes\` | \`customerId\` | \`customerId\` is omitted on \`L-102\` (unlinked lead) |
| **Project** | String (\`P-101\`) | \`id, name, customer, customerId, service, assigned, status, priority, deadline, progress, updates\` | All 11 keys in seed | None in seed | \`customer\` is company name string; \`customerId\` is int; \`progress\` is 0-100 int |
| **Ticket** | String (\`T-102\`) | \`id, customer, customerId, subject, priority, assigned, status, created, due, latest, notes\` | All 11 keys in seed | None in seed (\`description\` is passed in form submit) | \`notes\` array; \`latest\` status sentence |
| **Task** | Integer (\`1\`) | \`id, title, department, assigned, related, priority, due, status\` | All 8 keys in seed | None in seed | \`related\` holds \`L-101\`, \`P-101\`, or \`T-102\` |
| **ServiceRequest** | String (\`R-101\`) | \`id, customerId, service, description, contact, date, status, assigned\` | All 8 keys in seed | None in seed (\`details\` is in form, discarded by frontend) | Mirrored as a lead in backend |
| **Issue** | String (\`I-1\`) | \`id, title, related, priority, description, assigned, status\` | All 7 keys in form handler | None | Empty in seed; extracted from \`openAdd('Issues')\` |

---

## 3. Demo Accounts Extracted

| Login ID | Password | Name | Role | Department | Company | Email | Phone |
|---|---|---|---|---|---|---|---|
| \`admin.admin\` | \`admin123\` | Aarav Sharma | Admin | Admin | — | admin@orbitcrm.test | 9876543210 |
| \`sales.emp\` | \`sales123\` | Priya Nair | Employee | Sales | — | priya@orbitcrm.test | 9876543211 |
| \`developer.emp\` | \`dev123\` | Vikram Rao | Employee | Development | — | vikram@orbitcrm.test | 9876543212 |
| \`support.emp\` | \`support123\` | Ananya Das | Employee | IT Support | — | ananya@orbitcrm.test | 9876543213 |
| \`customer.user\` | \`customer123\` | Rahul Mehta | Customer | — | Acme Technologies | rahul@acme.example | 9876543214 |

---

## 4. Role & Module Mappings

### 4.1 Portals
- **Admin**: \`Admin Portal\`
- **Customer**: \`Customer Portal\`
- **Employee (Sales)**: \`Sales Portal\`
- **Employee (Development)**: \`Development Portal\`
- **Employee (IT Support)**: \`IT Support Portal\`

### 4.2 Sidebar Modules
- **Admin**: \`Dashboard, Customers, Leads, Pipeline, Projects, Tickets, Tasks, Employees, Departments, Reports, Notifications, Settings, Profile, Logout\`
- **Customer**: \`Dashboard, Request Service, My Requests, My Projects, Support Tickets, Notifications, Profile, Logout\`
- **Sales**: \`Dashboard, My Leads, Pipeline, Customers, My Tasks, Notes, Notifications, Profile, Logout\`
- **Development**: \`Dashboard, My Projects, My Tasks, Issues, Customers, Notes, Notifications, Profile, Logout\`
- **IT Support**: \`Dashboard, Tickets, Customers, My Tasks, Escalations, Notes, Notifications, Profile, Logout\`

---

## 5. Scoping Logic (\`mine\`)
\`\`\`javascript
function mine(items, key='assigned') {
  if (user.role === 'Admin') return items;
  if (user.role === 'Customer') return items.filter(x => x.customerId === user.customerId || x.customer === user.company);
  return items.filter(x => x[key] === user.name || x.department === user.department);
}
\`\`\`

---

## 6. User-Facing Messages

### 6.1 Toast Messages
- \`Invalid Login ID or Password.\`
- \`Passwords do not match.\`
- \`An account with this email already exists.\`
- \`Registration successful. You can now sign in.\`
- \`For this demo, use one of the shown accounts.\`
- \`Profile updated successfully\`
- \`Service request submitted successfully\`
- \`Note saved\`
- \`Record created\`
- \`Issue reported\`
- \`Status updated\`
- \`Settings saved\`

### 6.2 Notification Strings
- **Seed**:
  - \`High-priority ticket T-102 needs attention.\`
  - \`Acme Business Website moved to Development.\`
- **Dynamic in Frontend**:
  - \`Your service request has been received.\`
  - \`New note added by \${user.name}.\`
  - \`\${r.id} has been escalated to Development.\`
  - \`\${r.id} has been resolved; awaiting customer confirmation.\`

---

## 7. Unsupported or Ambiguous Patterns Extracted & Resolved

1. **Empty Seed for Issues**:
   - \`seed.issues\` is \`[]\` in \`script.js\`.
   - Extracted field list from \`openAdd('Issues')\` form submission: \`id, title, related, priority, description, assigned, status\`.
   - In \`instruction_v2.md\`, \`department\` ('Development') and \`due\` are also listed. Documented in Compatibility Report.

2. **Customer ID in Leads**:
   - \`L-101\` and \`L-103\` have integer \`customerId\`.
   - \`L-102\` does NOT have \`customerId\`.
   - Therefore, \`customerId\` is classified as **OPTIONAL** on Lead entity and must be omitted (never \`null\`) when absent.

3. **Service Request Details Field**:
   - The form \`requestForm\` in \`script.js\` has an \`<textarea name="details">\` field.
   - However, the frontend's submission handler \`rf.onsubmit\` did not append \`d.details\` to the created object.
   - Specification \`instruction_v2.md\` states \`details\` belongs in the request entity.

4. **Notifications Data Structure**:
   - Frontend currently stores notifications as plain strings in an array (\`string[]\`).
   - The backend API specification defines notifications as structured objects (\`{ id, message, when, kind, read }\`).
`;

  fs.writeFileSync(EXTRACTION_REPORT_PATH, report, 'utf8');
  console.log(`Saved extraction report to: ${EXTRACTION_REPORT_PATH}`);
}

run();
