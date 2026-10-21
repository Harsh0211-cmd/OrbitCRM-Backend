require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { validateEnv } = require('./src/config/env');
const { checkDbConnection } = require('./src/config/db');
const { notFoundHandler, globalErrorHandler } = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/auth');
const bootstrapRoutes = require('./src/routes/bootstrap');
const customersRoutes = require('./src/routes/customers');
const leadsRoutes = require('./src/routes/leads');
const projectsRoutes = require('./src/routes/projects');
const ticketsRoutes = require('./src/routes/tickets');
const tasksRoutes = require('./src/routes/tasks');
const requestsRoutes = require('./src/routes/requests');
const employeesRoutes = require('./src/routes/employees');
const departmentsRoutes = require('./src/routes/departments');
const dashboardRoutes = require('./src/routes/dashboard');
const notificationsRoutes = require('./src/routes/notifications');
const issuesRoutes = require('./src/routes/issues');
const notesRoutes = require('./src/routes/notes');
const settingsRoutes = require('./src/routes/settings');
const reportsRoutes = require('./src/routes/reports');
const searchRoutes = require('./src/routes/search');
const eventsRoutes = require('./src/routes/events');

const env = validateEnv();
const app = express();
const PORT = env.PORT || 3000;

// CORS setup
const corsOptions = {
  origin: env.FRONTEND_ORIGIN === '*' ? true : env.FRONTEND_ORIGIN,
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// 1. Mount API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/bootstrap', bootstrapRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/leads', leadsRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/tickets', ticketsRoutes);
app.use('/api/v1/tasks', tasksRoutes);
app.use('/api/v1/requests', requestsRoutes);
app.use('/api/v1/employees', employeesRoutes);
app.use('/api/v1/departments', departmentsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/issues', issuesRoutes);
app.use('/api/v1/notes', notesRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/events', eventsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'OrbitCRM API' });
});

// 2. API 404 handler (Rule F2: API routes must NEVER be shadowed by static fallback)
app.use('/api', notFoundHandler);

// 3. Dynamic client adapter endpoint
app.get('/api-adapter.js', (req, res) => {
  const adapterPath = path.join(__dirname, 'src', 'adapter', 'frontend-adapter.js');
  res.type('application/javascript').sendFile(adapterPath);
});

// 4. Static frontend serving with seamless adapter injection
const frontendDir = path.join(__dirname, 'orbitcrm-frontend-main', 'orbitcrm-frontend-main');
const indexHtmlPath = path.join(frontendDir, 'index.html');

app.get(['/', '/index.html'], (req, res) => {
  if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');
    if (!html.includes('/api-adapter.js')) {
      html = html.replace(
        '<script src="script.js"></script>',
        '<script src="/api-adapter.js"></script>\n  <script src="script.js"></script>'
      );
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
  res.status(404).send('Frontend not found');
});

app.use(express.static(frontendDir));

// 5. Global Error Handler
app.use(globalErrorHandler);

// Startup logic
async function startServer() {
  // Startup connectivity check per Rule DB3 (skipped in isolated test mode)
  if (env.NODE_ENV !== 'test') {
    try {
      await checkDbConnection();
      console.log('Database connected successfully.');
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`OrbitCRM backend running on http://localhost:${PORT}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer
};
