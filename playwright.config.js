const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  timeout: 30000,
  webServer: {
    command: 'node index.js',
    port: 3005,
    env: {
      PORT: '3005',
      NODE_ENV: 'test',
      JWT_SECRET: 'a-super-secret-jwt-key-with-over-thirty-two-characters-2026',
      FRONTEND_ORIGIN: 'http://127.0.0.1:3005'
    },
    reuseExistingServer: false
  },
  use: {
    baseURL: 'http://127.0.0.1:3005',
    headless: true
  }
});
