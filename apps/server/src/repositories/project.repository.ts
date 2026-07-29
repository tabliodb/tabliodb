import { Injectable } from '@nestjs/common';
import { ProjectRole } from '@tabliodb/shared';
import { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, ProjectTable } from '../schema/index.js';

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

      return project;
    });
  }

  getVisibleToUser(userId: string) {
    return this.db
      .selectFrom('projects')
      .innerJoin('project_members', 'project_members.projectId', 'projects.id')
      .selectAll('projects')
      .where('project_members.userId', '=', userId)
      .orderBy('projects.updatedAt', 'desc')
      .execute();
  }

  getByIdForUser(userId: string, projectId: string) {
    return this.db
      .selectFrom('projects')
      .innerJoin('project_members', 'project_members.projectId', 'projects.id')
      .selectAll('projects')
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
