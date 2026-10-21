const { test, expect } = require('@playwright/test');

test.describe('OrbitCRM Multi-Role End-to-End Workflows (Rule F3, F4, REQ-E2E-02)', () => {
  test('Admin Flow: Loads login page, signs in, and navigates core admin modules', async ({ page }) => {
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('response', resp => {
      if (resp.status() >= 400 && !resp.url().includes('favicon.ico')) {
        failedRequests.push({ url: resp.url(), status: resp.status() });
      }
    });

    await page.goto('/');

    await expect(page.locator('h2')).toHaveText('Welcome back');
    await expect(page.locator('.brand').first()).toContainText('OrbitCRM');
    await expect(page.locator('.demo')).toBeVisible();

    // Sign in as Admin
    await page.fill('input[name="id"]', 'admin.admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"], button.primary.full');

    await expect(page.locator('.portal-label')).toHaveText('ADMIN PORTAL');
    await expect(page.locator('.topbar h1')).toHaveText('Welcome back, Aarav');
    await expect(page.locator('.stat-grid')).toContainText('TOTAL CUSTOMERS');

    // Navigate to Customers
    await page.click('button[data-page="Customers"]');
    await expect(page.locator('.list-header h2')).toHaveText('Customers');
    await expect(page.locator('.data-table')).toBeVisible();

    // Navigate to Leads
    await page.click('button[data-page="Leads"]');
    await expect(page.locator('.list-header h2')).toHaveText('Leads');

    // Navigate to Pipeline
    await page.click('button[data-page="Pipeline"]');
    await expect(page.locator('.list-header h2')).toHaveText('Sales Pipeline');

    // Navigate to Employees
    await page.click('button[data-page="Employees"]');
    await expect(page.locator('.list-header h2')).toHaveText('Employees');

    // Navigate to Reports
    await page.click('button[data-page="Reports"]');
    await expect(page.locator('.panel h2').first()).toContainText('summary');

    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test('Sales Flow: Signs in, sees Sales Portal, and navigates pipeline and leads', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.fill('input[name="id"]', 'sales.emp');
    await page.fill('input[name="password"]', 'sales123');
    await page.click('button.primary.full');

    await expect(page.locator('.portal-label')).toHaveText('SALES PORTAL');
    await expect(page.locator('.topbar h1')).toHaveText('Welcome back, Priya');
    await expect(page.locator('.stat-grid')).toContainText('MY LEADS');

    // Navigate to My Leads
    await page.click('button[data-page="My Leads"]');
    await expect(page.locator('.list-header h2')).toHaveText('My Leads');
    await expect(page.locator('.data-table')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('Development Flow: Signs in, sees Development Portal, and views projects', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.fill('input[name="id"]', 'developer.emp');
    await page.fill('input[name="password"]', 'dev123');
    await page.click('button.primary.full');

    await expect(page.locator('.portal-label')).toHaveText('DEVELOPMENT PORTAL');
    await expect(page.locator('.topbar h1')).toHaveText('Welcome back, Vikram');
    await expect(page.locator('.stat-grid')).toContainText('ACTIVE PROJECTS');

    // Navigate to My Projects
    await page.click('button[data-page="My Projects"]');
    await expect(page.locator('.list-header h2')).toHaveText('My Projects');

    expect(consoleErrors).toEqual([]);
  });

  test('IT Support Flow: Signs in, sees IT Support Portal, and views tickets', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.fill('input[name="id"]', 'support.emp');
    await page.fill('input[name="password"]', 'support123');
    await page.click('button.primary.full');

    await expect(page.locator('.portal-label')).toHaveText('IT SUPPORT PORTAL');
    await expect(page.locator('.topbar h1')).toHaveText('Welcome back, Ananya');
    await expect(page.locator('.stat-grid')).toContainText('OPEN TICKETS');

    // Navigate to Tickets
    await page.click('button[data-page="Tickets"]');
    await expect(page.locator('.list-header h2')).toHaveText('Tickets');

    expect(consoleErrors).toEqual([]);
  });

  test('Customer Flow: Signs in, views Customer Portal, and submits a service request', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.fill('input[name="id"]', 'customer.user');
    await page.fill('input[name="password"]', 'customer123');
    await page.click('button.primary.full');

    await expect(page.locator('.portal-label')).toHaveText('CUSTOMER PORTAL');
    await expect(page.locator('.topbar h1')).toHaveText('Welcome back, Rahul');
    await expect(page.locator('.stat-grid')).toContainText('ACTIVE REQUESTS');

    // Navigate to Request Service form
    await page.click('button[data-page="Request Service"]');
    await expect(page.locator('.panel h2')).toHaveText('Request a Service');

    // Fill form and submit
    await page.fill('textarea[name="description"]', 'Enterprise cloud maintenance and disaster recovery.');
    await page.click('button:has-text("Submit service request")');

    // Verify toast or redirect to My Requests
    await expect(page.locator('#toast')).toContainText('Service request submitted successfully');
    await expect(page.locator('.list-header h2')).toHaveText('My Requests');

    expect(consoleErrors).toEqual([]);
  });
});
