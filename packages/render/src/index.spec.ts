import { createStarterDiagramModel } from '@tabliodb/schema-core';
import { describe, expect, it } from 'vitest';
import { generateDiagramSvg } from './index.js';

describe('generateDiagramSvg', () => {
  it('renders tables, rows, and relationship markers from the starter diagram', () => {
    const svg = generateDiagramSvg(createStarterDiagramModel());

    expect(svg).toContain('<svg');
    expect(svg).toContain('Library System');
    expect(svg).toContain('users');
    expect(svg).toContain('borrowings');
    expect(svg).toContain('marker-end="url(#tabliodb-many)"');
    expect(svg).toContain('user_id');
  });

  it('escapes text and attributes for safe SVG output', () => {
    const model = createStarterDiagramModel('Billing <Core> "Main"');
    model.tables.users.name = 'users & accounts';

    const svg = generateDiagramSvg(model);

    expect(svg).toContain('Billing &lt;Core&gt; &quot;Main&quot; schema diagram');
    expect(svg).toContain('users &amp; accounts');
  });
});
