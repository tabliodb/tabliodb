import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';

export type EditorPreferenceTarget = {
  lastOpenedDiagramId: string | null;
  lastOpenedOrganizationId: string;
  lastOpenedFolderId: string | null;
};

@Injectable()
export class UserPreferenceRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  getEditorPreference(userId: string) {
    return this.db.selectFrom('user_editor_preferences').selectAll().where('userId', '=', userId).executeTakeFirst();
  }

  async upsertEditorPreference(userId: string, target: EditorPreferenceTarget) {
    const now = new Date();

    await this.db
      .insertInto('user_editor_preferences')
      .values({
        userId,
        lastOpenedDiagramId: target.lastOpenedDiagramId,
        lastOpenedOrganizationId: target.lastOpenedOrganizationId,
        lastOpenedFolderId: target.lastOpenedFolderId,
        updatedAt: now,
      })
      .onConflict((oc) =>
        oc.column('userId').doUpdateSet({
          lastOpenedDiagramId: target.lastOpenedDiagramId,
          lastOpenedOrganizationId: target.lastOpenedOrganizationId,
          lastOpenedFolderId: target.lastOpenedFolderId,
          updatedAt: now,
        }),
      )
      .execute();

    // Re-reading keeps the repository contract consistent with database defaults such as created_at.
    return this.getEditorPreference(userId);
  }

  async deleteEditorPreference(userId: string): Promise<void> {
    await this.db.deleteFrom('user_editor_preferences').where('userId', '=', userId).execute();
  }
}
