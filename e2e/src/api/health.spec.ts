import { expect, test } from '@playwright/test';

const apiUrl = process.env.TABLIODB_API_URL || 'http://localhost:4000/api';

test('server health endpoint responds', async ({ request }) => {
  const response = await request.get(`${apiUrl}/server/health`);
  expect(response.ok()).toBeTruthy();
});
