import { CamelCasePlugin, PostgresDialect } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

export function getKyselyConfig(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });

  return {
    dialect: new PostgresJSDialect({ postgres: client }) as unknown as PostgresDialect,
    // The physical PostgreSQL schema uses snake_case while the TypeScript repositories keep idiomatic camelCase fields.
    // JSONB diagram payloads store entity IDs as dynamic object keys, for example `table_abc` and `column_def`.
    // Those keys are application data, not database identifiers, so Kysely must not camelCase nested JSON objects into `tableAbc`.
    plugins: [new CamelCasePlugin({ maintainNestedObjectKeys: true })],
  };
}
