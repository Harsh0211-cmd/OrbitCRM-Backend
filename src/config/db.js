const mysql = require('mysql2/promise');
const { validateEnv } = require('./env');

let env;
try {
  env = validateEnv();
} catch (e) {
  // Fallback for isolated test cases
  env = {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: Number(process.env.DB_PORT) || 3306,
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME || 'orbitcrm'
  };
}

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00'
});

function sanitizeErrorMessage(errMsg, password) {
  let sanitized = errMsg || 'Unknown database error';
  if (password) {
    sanitized = sanitized.split(password).join('***');
  }
  return sanitized;
}

async function checkDbConnection(customPool = pool, customPassword = env.DB_PASSWORD) {
  try {
    await customPool.query('SELECT 1');
    return true;
  } catch (err) {
    const sanitized = sanitizeErrorMessage(err.message, customPassword);
    const failureMsg = [
      `Database connection failed: ${sanitized}`,
      'Please check your database configuration: host, port, credentials, and network connectivity.'
    ].join(' ');
    const safeError = new Error(failureMsg);
    safeError.code = err.code || 'DB_CONNECTION_ERROR';
    throw safeError;
  }
}

module.exports = {
  pool,
  checkDbConnection,
  sanitizeErrorMessage
};
