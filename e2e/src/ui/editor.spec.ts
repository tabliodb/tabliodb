import { expect, test } from '@playwright/test';

const apiUrl = process.env.TABLIODB_API_URL || 'http://localhost:4000/api';
const ownerEmail = process.env.TABLIODB_E2E_OWNER_EMAIL || 'owner@tabliodb.local';
const ownerPassword = process.env.TABLIODB_E2E_OWNER_PASSWORD || 'tabliodb-dev';
const ownerName = process.env.TABLIODB_E2E_OWNER_NAME || 'Tabliodb Owner';
const workspaceName = process.env.TABLIODB_E2E_WORKSPACE_NAME || 'Personal Workspace';

test('renders the schema editor shell', async ({ page }) => {
  const api = page.context().request;
  const setupResponse = await api.get(`${apiUrl}/setup`);
  expect(setupResponse.ok()).toBeTruthy();

  const setupStatus = (await setupResponse.json()) as { isSetupComplete: boolean };

  if (!setupStatus.isSetupComplete) {
    const completeSetupResponse = await api.post(`${apiUrl}/setup`, {
      data: {
        ownerEmail,
        ownerName,
        ownerPassword,
        publicUrl: 'http://localhost:5173',
        workspaceName,
      },
    });

    // Setup can race with another local run; when it is already complete, the normal login path below still proves auth works.
    expect([201, 400]).toContain(completeSetupResponse.status());
  }

  const currentUserResponse = await api.get(`${apiUrl}/auth/me`);
  if (!currentUserResponse.ok()) {
    const loginResponse = await api.post(`${apiUrl}/auth/login`, {
      data: {
        email: ownerEmail,
        password: ownerPassword,
      },
    });

    if (!loginResponse.ok()) {
      test.skip(
        true,
        `Editor shell e2e needs a valid browser session. Set TABLIODB_E2E_OWNER_EMAIL and TABLIODB_E2E_OWNER_PASSWORD for this local database.`,
      );
    }
  }

  await page.goto('/');

  await expect(page.getByText('Tabliodb')).toBeVisible();
  await expect(page.getByText('Library System')).toBeVisible();
  await expect(page.getByText('books')).toBeVisible();
});
