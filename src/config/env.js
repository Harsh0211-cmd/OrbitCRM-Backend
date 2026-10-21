require('dotenv').config();

const KNOWN_DEFAULT_SECRETS = [
  'default_secret',
  'secret',
  '12345678901234567890123456789012',
  'your-jwt-secret-here-must-be-32-chars-long'
];

function validateEnv(overrideEnv = process.env) {
  const jwtSecret = overrideEnv.JWT_SECRET;
  const nodeEnv = overrideEnv.NODE_ENV || 'development';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be defined');
  }

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  if (nodeEnv !== 'development' && KNOWN_DEFAULT_SECRETS.includes(jwtSecret)) {
    throw new Error('JWT_SECRET cannot use a known default secret in production/test');
  }

  if (nodeEnv !== 'development' && (!overrideEnv.FRONTEND_ORIGIN || overrideEnv.FRONTEND_ORIGIN === '*')) {
    throw new Error("FRONTEND_ORIGIN cannot be '*' outside development");
  }

  return {
    PORT: Number(overrideEnv.PORT) || 3000,
    DB_HOST: overrideEnv.DB_HOST || 'localhost',
    DB_PORT: Number(overrideEnv.DB_PORT) || 3306,
    DB_USER: overrideEnv.DB_USER || 'root',
    DB_PASSWORD: overrideEnv.DB_PASSWORD,
    DB_NAME: overrideEnv.DB_NAME || 'orbitcrm',
    JWT_SECRET: jwtSecret,
    FRONTEND_ORIGIN: overrideEnv.FRONTEND_ORIGIN || '*',
    NODE_ENV: nodeEnv,
    TEST_DATABASE_URL: overrideEnv.TEST_DATABASE_URL,
    DATABASE_URL: overrideEnv.DATABASE_URL
  };
}

function validateTestDatabaseIsolation(overrideEnv = process.env) {
  const dbUrl = overrideEnv.DATABASE_URL;
  const testDbUrl = overrideEnv.TEST_DATABASE_URL;

  if (testDbUrl && dbUrl && testDbUrl.trim() === dbUrl.trim()) {
    throw new Error('TEST_DATABASE_URL cannot equal DATABASE_URL. Database tests must never run against real database.');
  }

  return true;
}

module.exports = {
  validateEnv,
  validateTestDatabaseIsolation,
  KNOWN_DEFAULT_SECRETS
};
