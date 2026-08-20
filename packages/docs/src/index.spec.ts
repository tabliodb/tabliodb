import { createStarterDiagramModel } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import { generateDiagramMarkdown, generateDiagramMermaid } from './index.js';

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

describe('generateDiagramMermaid', () => {
  it('renders a deterministic Mermaid ERD with keys and relationships', () => {
    const mermaid = generateDiagramMermaid(createStarterDiagramModel());

    expect(mermaid).toContain('erDiagram');
    expect(mermaid).toContain('  USERS {');
    expect(mermaid).toContain('    uuid id PK');
    expect(mermaid).toContain('    varchar_190 email UK');
    expect(mermaid).toContain('  BORROWINGS {');
    expect(mermaid).toContain('    uuid user_id FK');
    expect(mermaid).toContain('  USERS ||--o{ BORROWINGS : borrowings_user_id_fkey');
  });

  it('sanitizes Mermaid identifiers without losing stable uniqueness', () => {
    const model = createStarterDiagramModel('Mermaid docs');

    model.tables.users.name = 'users & accounts';
    model.tables.books.name = 'users accounts';
    model.columns['users-email']!.name = 'email address';

    const mermaid = generateDiagramMermaid(model);

    expect(mermaid).toContain('  USERS_ACCOUNTS {');
    expect(mermaid).toContain('  USERS_ACCOUNTS_2 {');
    expect(mermaid).toContain('email_address UK');
  });
});
