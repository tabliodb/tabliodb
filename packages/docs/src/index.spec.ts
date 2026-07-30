import { createStarterDiagramModel } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import { generateDiagramMarkdown } from './index.js';

describe('generateDiagramMarkdown', () => {
  it('renders a stable schema documentation outline', () => {
    const markdown = generateDiagramMarkdown(createStarterDiagramModel());

    expect(markdown).toContain('# Library System');
    expect(markdown).toContain('| Column | Type | Nullable | PK | Unique | Default | Comment |');
    expect(markdown).toContain('| email | varchar(190) | No | No | Yes |  |  |');
    expect(markdown).toContain('| borrowings_user_book_idx | borrowings | user_id, book_id | No |  |  |');
    expect(markdown).toContain(
      '| borrowings_user_id_fkey | users.id | borrowings.user_id | one to many | ON DELETE CASCADE |  |',
    );
  });

  it('escapes markdown table cells', () => {
    const model = createStarterDiagramModel('Docs | Test');
    model.tables.users.comment = 'Users | accounts';
    model.columns['users-name']!.comment = 'Display\nname';

    const markdown = generateDiagramMarkdown(model);

    expect(markdown).toContain('Users \\| accounts');
    expect(markdown).toContain('Display<br />name');
  });
});
