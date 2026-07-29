import { Injectable } from '@nestjs/common';
import { ProjectRole } from '@tabliodb/shared';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, ProjectTable } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

export type ProjectListOptions = {
  cursor?: string;
  limit: number;
  organizationId?: string;
};

export type ProjectMemberListOptions = {
  cursor?: string;
  limit: number;
};

@Injectable()
export class ProjectRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  create(dto: Insertable<ProjectTable>) {
    return this.db.transaction().execute(async (tx) => {
      const project = await tx.insertInto('projects').values(dto).returningAll().executeTakeFirstOrThrow();

      // The creator gets project-level ownership immediately, independent of organization-level role changes later.
      await tx
        .insertInto('project_members')
        .values({ projectId: project.id, userId: dto.createdById, role: ProjectRole.Owner })
        .execute();

      return tx
        .selectFrom('projects')
        .innerJoin('organizations', 'organizations.id', 'projects.organizationId')
        .select([
          'projects.id',
          'projects.organizationId',
          'projects.name',
          'projects.slug',
          'projects.description',
          'projects.createdAt',
          'projects.updatedAt',
          'organizations.name as organizationName',
          'organizations.slug as organizationSlug',
        ])
        .where('projects.id', '=', project.id)
        .executeTakeFirstOrThrow();
    });
  }

  async getVisibleToUser(userId: string, options: ProjectListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('projects')
      .innerJoin('organizations', 'organizations.id', 'projects.organizationId')
      .innerJoin('project_members', 'project_members.projectId', 'projects.id')
      .select([
        'projects.id',
        'projects.organizationId',
        'projects.name',
        'projects.slug',
        'projects.description',
        'projects.createdAt',
        'projects.updatedAt',
        'organizations.name as organizationName',
        'organizations.slug as organizationSlug',
      ])
      .where('project_members.userId', '=', userId)
      .where('projects.archivedAt', 'is', null)
      .$if(Boolean(options.organizationId), (query) =>
        query.where('projects.organizationId', '=', options.organizationId!),
      )
      .orderBy('projects.updatedAt', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('projects')
      .innerJoin('project_members', 'project_members.projectId', 'projects.id')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('project_members.userId', '=', userId)
      .where('projects.archivedAt', 'is', null)
      .$if(Boolean(options.organizationId), (query) =>
        query.where('projects.organizationId', '=', options.organizationId!),
      )
      .executeTakeFirstOrThrow();

    return {
      // List project dipaginasi walau editor saat ini hanya memakai page pertama untuk starter workspace.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getByIdForUser(userId: string, projectId: string) {
    return this.db
      .selectFrom('projects')
      .innerJoin('organizations', 'organizations.id', 'projects.organizationId')
      .innerJoin('project_members', 'project_members.projectId', 'projects.id')
      .select([
        'projects.id',
        'projects.organizationId',
        'projects.name',
        'projects.slug',
        'projects.description',
        'projects.createdAt',
        'projects.updatedAt',
        'organizations.name as organizationName',
        'organizations.slug as organizationSlug',
      ])
      .where('project_members.userId', '=', userId)
      .where('projects.id', '=', projectId)
      .where('projects.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  getProjectRole(userId: string, projectId: string) {
    return this.db
      .selectFrom('project_members')
      .innerJoin('projects', 'projects.id', 'project_members.projectId')
      .select('project_members.role')
      .where('project_members.userId', '=', userId)
      .where('project_members.projectId', '=', projectId)
      .where('projects.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  getDiagramRole(userId: string, diagramId: string) {
    return this.db
      .selectFrom('diagrams')
      .innerJoin('project_members', 'project_members.projectId', 'diagrams.projectId')
      .innerJoin('projects', 'projects.id', 'diagrams.projectId')
      .select('project_members.role')
      .where('project_members.userId', '=', userId)
      .where('diagrams.id', '=', diagramId)
      .where('projects.archivedAt', 'is', null)
      .where('diagrams.archivedAt', 'is', null)
      .executeTakeFirst();
  }

  async update(projectId: string, dto: { description?: string | null; name?: string }) {
    const values: { description?: string | null; name?: string; slug?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      values.name = dto.name;
      values.slug = slugify(dto.name);
    }

    if (dto.description !== undefined) {
      values.description = dto.description;
    }

    const project = await this.db
      .updateTable('projects')
      .set(values)
      .where('id', '=', projectId)
      .where('archivedAt', 'is', null)
      .returning('id')
      .executeTakeFirst();

    return project ? this.getById(project.id) : undefined;
  }

  async archive(projectId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('projects')
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', projectId)
      .where('archivedAt', 'is', null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async getMembers(projectId: string, options: ProjectMemberListOptions) {
    const offset = decodeOffsetCursor(options.cursor);
    const rows = await this.db
      .selectFrom('project_members')
      .innerJoin('users', 'users.id', 'project_members.userId')
      .select([
        'project_members.userId',
        'users.email',
        'users.name',
        'users.avatarColor',
        'project_members.role',
        'project_members.createdAt',
        'project_members.updatedAt',
      ])
      .where('project_members.projectId', '=', projectId)
      .where('users.deletedAt', 'is', null)
      .orderBy('project_members.createdAt', 'asc')
      .orderBy('project_members.userId', 'asc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('project_members')
      .innerJoin('users', 'users.id', 'project_members.userId')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('project_members.projectId', '=', projectId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      // Project member list is paginated from the first implementation so large internal teams do not force a later API break.
      items: rows.slice(0, options.limit),
      nextCursor: rows.length > options.limit ? encodeOffsetCursor(offset + options.limit) : null,
      totalCount: Number(totalRow.count),
    };
  }

  getMember(projectId: string, userId: string) {
    return this.db
      .selectFrom('project_members')
      .innerJoin('users', 'users.id', 'project_members.userId')
      .select([
        'project_members.userId',
        'users.email',
        'users.name',
        'users.avatarColor',
        'project_members.role',
        'project_members.createdAt',
        'project_members.updatedAt',
      ])
      .where('project_members.projectId', '=', projectId)
      .where('project_members.userId', '=', userId)
      .where('users.deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async upsertMember(projectId: string, options: { createdById: string; role: ProjectRole; userId: string }) {
    await this.db
      .insertInto('project_members')
      .values({
        createdById: options.createdById,
        projectId,
        role: options.role,
        userId: options.userId,
      })
      .onConflict((oc) =>
        oc.columns(['projectId', 'userId']).doUpdateSet({
          role: options.role,
          updatedAt: new Date(),
        }),
      )
      .execute();

    return this.getMember(projectId, options.userId);
  }

  async updateMember(projectId: string, userId: string, role: ProjectRole) {
    const member = await this.db
      .updateTable('project_members')
      .set({ role, updatedAt: new Date() })
      .where('projectId', '=', projectId)
      .where('userId', '=', userId)
      .returning('userId')
      .executeTakeFirst();

    return member ? this.getMember(projectId, member.userId) : undefined;
  }

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('project_members')
      .where('projectId', '=', projectId)
      .where('userId', '=', userId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async getProjectOwnerCount(projectId: string): Promise<number> {
    const row = await this.db
      .selectFrom('project_members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('projectId', '=', projectId)
      .where('role', '=', ProjectRole.Owner)
      .executeTakeFirstOrThrow();

    return Number(row.count);
  }

  private getById(projectId: string) {
    return this.db
      .selectFrom('projects')
      .innerJoin('organizations', 'organizations.id', 'projects.organizationId')
      .select([
        'projects.id',
        'projects.organizationId',
        'projects.name',
        'projects.slug',
        'projects.description',
        'projects.createdAt',
        'projects.updatedAt',
        'organizations.name as organizationName',
        'organizations.slug as organizationSlug',
      ])
      .where('projects.id', '=', projectId)
      .where('projects.archivedAt', 'is', null)
      .executeTakeFirst();
  }
}
