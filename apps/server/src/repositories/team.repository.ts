import { Injectable } from '@nestjs/common';
import { AccessRole } from '@tabliodb/shared';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

export type TeamListOptions = {
  cursor?: string;
  limit: number;
  organizationId: string;
};

export type TeamChildListOptions = {
  cursor?: string;
  limit: number;
};

export type TeamAccessRole = AccessRole.Editor | AccessRole.Commenter | AccessRole.Viewer;
export type TeamDiagramRole = AccessRole.Editor | AccessRole.Commenter | AccessRole.Viewer;

@Injectable()
export class TeamRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async create(options: { createdById: string; description?: string | null; name: string; organizationId: string }) {
    const team = await this.db
      .insertInto('teams')
      .values({
        createdById: options.createdById,
        description: options.description ?? null,
        name: options.name,
        organizationId: options.organizationId,
        slug: slugify(options.name),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return this.getById(team.id);
  }

  getById(teamId: string) {
    return this.db
      .selectFrom('teams')
      .select([
        'id',
        'organizationId',
        'name',
        'slug',
        'description',
        'createdAt',
        'updatedAt',
        sql<number>`(
          SELECT count(*)::int
          FROM team_members
          WHERE team_members.team_id = teams.id
        )`.as('memberCount'),
        sql<number>`(
          SELECT count(*)::int
          FROM folder_team_access
          WHERE folder_team_access.team_id = teams.id
        )`.as('folderAccessCount'),
        sql<number>`(
          SELECT count(*)::int
          FROM diagram_team_access
          WHERE diagram_team_access.team_id = teams.id
        )`.as('diagramAccessCount'),
      ])
      .where('id', '=', teamId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async list(options: TeamListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('teams')
      .select([
        'id',
        'organizationId',
        'name',
        'slug',
        'description',
        'createdAt',
        'updatedAt',
        sql<number>`(
          SELECT count(*)::int
          FROM team_members
          WHERE team_members.team_id = teams.id
        )`.as('memberCount'),
        sql<number>`(
          SELECT count(*)::int
          FROM folder_team_access
          WHERE folder_team_access.team_id = teams.id
        )`.as('folderAccessCount'),
        sql<number>`(
          SELECT count(*)::int
          FROM diagram_team_access
          WHERE diagram_team_access.team_id = teams.id
        )`.as('diagramAccessCount'),
      ])
      .where('organizationId', '=', options.organizationId)
      .where('archivedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .orderBy('id', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('teams')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', options.organizationId)
      .where('archivedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  async update(teamId: string, dto: { description?: string | null; name?: string }) {
    const values: {
      description?: string | null;
      name?: string;
      slug?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      values.name = dto.name;
      values.slug = slugify(dto.name);
    }

    if (dto.description !== undefined) {
      values.description = dto.description;
    }

    const team = await this.db
      .updateTable('teams')
      .set(values)
      .where('id', '=', teamId)
      .where('archivedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    return team ? this.getById(team.id) : undefined;
  }

  async archive(teamId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('teams')
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', teamId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async getMembers(teamId: string, options: TeamChildListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('team_members')
      .innerJoin('users', 'users.id', 'team_members.userId')
      .select([
        'team_members.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'team_members.createdAt',
      ])
      .where('team_members.teamId', '=', teamId)
      .where('users.deletedAt', 'is', null)
      .orderBy('team_members.createdAt', 'asc')
      .orderBy('team_members.userId', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('team_members')
      .innerJoin('users', 'users.id', 'team_members.userId')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('team_members.teamId', '=', teamId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getMember(teamId: string, userId: string) {
    return this.db
      .selectFrom('team_members')
      .innerJoin('users', 'users.id', 'team_members.userId')
      .select([
        'team_members.userId',
        'users.email',
        'users.name',
        sql<string | null>`case
          when users.avatar_file_id is null then null
          else concat('/api/files/', users.avatar_file_id::text)
        end`.as('avatarUrl'),
        'users.cursorColor',
        'team_members.createdAt',
      ])
      .where('team_members.teamId', '=', teamId)
      .where('team_members.userId', '=', userId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async addMember(teamId: string, options: { createdById: string; userId: string }) {
    await this.db
      .insertInto('team_members')
      .values({
        createdById: options.createdById,
        teamId,
        userId: options.userId,
      })
      .onConflict((oc) => oc.columns(['teamId', 'userId']).doNothing())
      .execute();

    return this.getMember(teamId, options.userId);
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('team_members')
      .where('teamId', '=', teamId)
      .where('userId', '=', userId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async getFolderAccesses(teamId: string, options: TeamChildListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('folder_team_access')
      .innerJoin('folders', 'folders.id', 'folder_team_access.folderId')
      .select([
        'folder_team_access.folderId',
        'folders.name as folderName',
        'folders.slug as folderSlug',
        'folder_team_access.role',
        'folder_team_access.createdAt',
        'folder_team_access.updatedAt',
      ])
      .where('folder_team_access.teamId', '=', teamId)
      .where('folders.archivedAt', 'is', null)
      .orderBy('folder_team_access.createdAt', 'asc')
      .orderBy('folder_team_access.folderId', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('folder_team_access')
      .innerJoin('folders', 'folders.id', 'folder_team_access.folderId')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('folder_team_access.teamId', '=', teamId)
      .where('folders.archivedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getFolderAccess(teamId: string, folderId: string) {
    return this.db
      .selectFrom('folder_team_access')
      .innerJoin('folders', 'folders.id', 'folder_team_access.folderId')
      .select([
        'folder_team_access.folderId',
        'folders.name as folderName',
        'folders.slug as folderSlug',
        'folder_team_access.role',
        'folder_team_access.createdAt',
        'folder_team_access.updatedAt',
      ])
      .where('folder_team_access.teamId', '=', teamId)
      .where('folder_team_access.folderId', '=', folderId)
      .where('folders.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async upsertFolderAccess(
    teamId: string,
    options: { createdById: string; folderId: string; role: TeamAccessRole },
  ) {
    await this.db
      .insertInto('folder_team_access')
      .values({
        createdById: options.createdById,
        folderId: options.folderId,
        role: options.role,
        teamId,
      })
      .onConflict((oc) =>
        oc.columns(['folderId', 'teamId']).doUpdateSet({
          role: options.role,
          updatedAt: new Date(),
        }),
      )
      .execute();

    return this.getFolderAccess(teamId, options.folderId);
  }

  async removeFolderAccess(teamId: string, folderId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('folder_team_access')
      .where('teamId', '=', teamId)
      .where('folderId', '=', folderId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async getDiagramAccesses(teamId: string, options: TeamChildListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('diagram_team_access')
      .innerJoin('diagrams', 'diagrams.id', 'diagram_team_access.diagramId')
      .select([
        'diagram_team_access.diagramId',
        'diagrams.name as diagramName',
        'diagrams.folderId',
        'diagram_team_access.role',
        'diagram_team_access.createdAt',
        'diagram_team_access.updatedAt',
      ])
      .where('diagram_team_access.teamId', '=', teamId)
      .where('diagrams.archivedAt', 'is', null)
      .orderBy('diagram_team_access.createdAt', 'asc')
      .orderBy('diagram_team_access.diagramId', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('diagram_team_access')
      .innerJoin('diagrams', 'diagrams.id', 'diagram_team_access.diagramId')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('diagram_team_access.teamId', '=', teamId)
      .where('diagrams.archivedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getDiagramAccess(teamId: string, diagramId: string) {
    return this.db
      .selectFrom('diagram_team_access')
      .innerJoin('diagrams', 'diagrams.id', 'diagram_team_access.diagramId')
      .select([
        'diagram_team_access.diagramId',
        'diagrams.name as diagramName',
        'diagrams.folderId',
        'diagram_team_access.role',
        'diagram_team_access.createdAt',
        'diagram_team_access.updatedAt',
      ])
      .where('diagram_team_access.teamId', '=', teamId)
      .where('diagram_team_access.diagramId', '=', diagramId)
      .where('diagrams.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async upsertDiagramAccess(
    teamId: string,
    options: { createdById: string; diagramId: string; role: TeamDiagramRole },
  ) {
    await this.db
      .insertInto('diagram_team_access')
      .values({
        createdById: options.createdById,
        diagramId: options.diagramId,
        role: options.role,
        teamId,
      })
      .onConflict((oc) =>
        oc.columns(['diagramId', 'teamId']).doUpdateSet({
          role: options.role,
          updatedAt: new Date(),
        }),
      )
      .execute();

    return this.getDiagramAccess(teamId, options.diagramId);
  }

  async removeDiagramAccess(teamId: string, diagramId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('diagram_team_access')
      .where('teamId', '=', teamId)
      .where('diagramId', '=', diagramId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  getFolderInOrganization(folderId: string, organizationId: string) {
    return this.db
      .selectFrom('folders')
      .select(['id', 'organizationId', 'name', 'slug'])
      .where('id', '=', folderId)
      .where('organizationId', '=', organizationId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();
  }

  getDiagramInOrganization(diagramId: string, organizationId: string) {
    return this.db
      .selectFrom('diagrams')
      .select(['id', 'organizationId', 'name', 'folderId'])
      .where('id', '=', diagramId)
      .where('organizationId', '=', organizationId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();
  }
}
