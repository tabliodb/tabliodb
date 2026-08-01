import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { InjectKysely } from 'nestjs-kysely';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { DB } from '../schema/index.js';

@Injectable()
export class DatabaseRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async ping(): Promise<void> {
    // Healthcheck memakai query paling murah agar readiness bisa memvalidasi koneksi PostgreSQL tanpa menyentuh domain data.
    await sql`select 1`.execute(this.db);
  }

  migrateToLatest() {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const migrationFolder = path.resolve(currentDir, '../schema/migrations');

    const migrator = new Migrator({
      db: this.db,
      provider: new FileMigrationProvider({
        fs,
        // Windows absolute paths need a file:// URL before dynamic import can load migration modules.
        import: (migrationPath) => import(pathToFileURL(migrationPath).href),
        path,
        migrationFolder,
      }),
    });

    return migrator.migrateToLatest();
  }
}
