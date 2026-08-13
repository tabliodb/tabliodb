import type { DatabaseDialect } from '@tabliodb/schema-core';

export function formatDiagramDialect(dialect: DatabaseDialect): string {
  if (dialect === 'postgresql') {
    return 'PostgreSQL';
  }

  if (dialect === 'mysql') {
    return 'MySQL';
  }

  if (dialect === 'mariadb') {
    return 'MariaDB';
  }

  if (dialect === 'sqlite') {
    return 'SQLite';
  }

  return 'SQL Server';
}
