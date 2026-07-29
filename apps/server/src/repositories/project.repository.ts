import { Injectable } from '@nestjs/common';
import { ProjectRole } from '@tabliodb/shared';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, ProjectTable } from '../schema/index.js';
import { decodeOffsetCursor, encodeOffsetCursor } from '../utils/pagination.js';

export type ProjectListOptions = {
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
      .orderBy('projects.updatedAt', 'desc')
      .limit(options.limit + 1)
      .offset(offset)
      .execute();
    const totalRow = await this.db
      .selectFrom('projects')
      .innerJoin('project_members', 'project_members.projectId', 'projects.id')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('project_members.userId', '=', userId)
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
      .executeTakeFirst();
  }

  getDiagramRole(userId: string, diagramId: string) {
    return this.db
      .selectFrom('diagrams')
      .innerJoin('project_members', 'project_members.projectId', 'diagrams.projectId')
      .select('project_members.role')
      .where('project_members.userId', '=', userId)
      .where('diagrams.id', '=', diagramId)
      .executeTakeFirst();
  }
}
