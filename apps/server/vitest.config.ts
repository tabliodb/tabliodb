import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const workspaceRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      // Server unit tests should execute workspace source, not stale package dist artifacts from a previous build.
      '@tabliodb/schema-core': resolve(workspaceRoot, 'packages/schema-core/src/index.ts'),
      '@tabliodb/shared': resolve(workspaceRoot, 'packages/shared/src/index.ts'),
      '@tabliodb/sql': resolve(workspaceRoot, 'packages/sql/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
