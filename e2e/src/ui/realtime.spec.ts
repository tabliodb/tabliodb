import { expect, test } from '@playwright/test';
import { createRealtimeSmokeDiagram, ensureOwnerSession } from '../support/tabliodb';

test('syncs table edits between two browser contexts in the same diagram', async ({ browser }) => {
  const editorAContext = await browser.newContext();
  const editorBContext = await browser.newContext();

  try {
    const editorALoggedIn = await ensureOwnerSession(editorAContext);
    test.skip(
      !editorALoggedIn,
      'Realtime e2e needs a valid owner session. Set TABLIODB_E2E_OWNER_EMAIL and TABLIODB_E2E_OWNER_PASSWORD for this database.',
    );

    const editorBLoggedIn = await ensureOwnerSession(editorBContext);
    test.skip(
      !editorBLoggedIn,
      'Realtime e2e needs a second valid owner session for the comparison browser context.',
    );

    const smokeDiagram = await createRealtimeSmokeDiagram(editorAContext);
    const editorAPage = await editorAContext.newPage();
    const editorBPage = await editorBContext.newPage();
    const nextTableName = `books_live_${Date.now().toString(36)}`;

    await editorAPage.goto(smokeDiagram.path);
    await editorBPage.goto(smokeDiagram.path);

    const editorATable = editorAPage.locator(`[data-tabliodb-table-id="${smokeDiagram.tableName}"]`);
    const editorBTableName = editorBPage
      .locator(`[data-tabliodb-table-id="${smokeDiagram.tableName}"] .tabliodb-table-node__name`)
      .first();

    await expect(editorATable).toBeVisible();
    await expect(editorBTableName).toHaveText(smokeDiagram.tableName);

    await editorATable.click();
    await editorAPage.getByLabel('Table name').fill(nextTableName);
    // Inline sidebar edits commit on blur; pressing Enter mirrors the real keyboard workflow and avoids depending on hidden buttons.
    await editorAPage.getByLabel('Table name').press('Enter');

    await expect(editorBTableName).toHaveText(nextTableName, { timeout: 10_000 });
  } finally {
    await editorBContext.close();
    await editorAContext.close();
  }
});
