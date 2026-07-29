import { expect, test } from '@playwright/test';

test('renders the schema editor shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Tabliodb')).toBeVisible();
  await expect(page.getByText('Library System')).toBeVisible();
  await expect(page.getByText('books')).toBeVisible();
});
