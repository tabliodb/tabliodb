import { Injectable } from '@nestjs/common';
import { OrganizationRole, ProjectRole } from '@tabliodb/shared';
import { Insertable, Kysely, type Transaction } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB, InvitationTable } from '../schema/index.js';

export type InvitationCreateRecord = Insertable<InvitationTable>;

export type InvitationRecord = {
  acceptedAt: Date | string | null;
  acceptedById: string | null;
  createdAt: Date | string;
  email: string;
  expiresAt: Date | string;
  id: string;
  invitedById: string;
  invitedByName: string;
  message: string | null;
  organizationId: string;
  organizationName: string;
  organizationRole: OrganizationRole.Admin | OrganizationRole.Member;
  organizationSlug: string;
  projectId: string | null;
  projectName: string | null;
  projectRole: ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer | null;
  revokedAt: Date | string | null;
};

export type InvitationAcceptedUser = {
  cursorColor: string;
  email: string;
  id: string;
  name: string;
};

@Injectable()
export class InvitationRepository {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async create(record: InvitationCreateRecord): Promise<InvitationRecord> {
    const invitation = await this.db.insertInto('invitations').values(record).returning('id').executeTakeFirstOrThrow();

    return this.getById(invitation.id) as Promise<InvitationRecord>;
  }

  async getByTokenHash(tokenHash: Buffer): Promise<InvitationRecord | undefined> {
    const row = await this.getInvitationQuery(this.db).where('invitations.tokenHash', '=', tokenHash).executeTakeFirst();

    return row ? this.toInvitationRecord(row) : undefined;
  }

  async acceptWithNewUser(options: {
    name: string;
    passwordHash: string;
    tokenHash: Buffer;
  }): Promise<{ invitation: InvitationRecord; user: InvitationAcceptedUser } | null> {
    return this.db.transaction().execute(async (tx) => {
      const invitation = await this.getInvitationQuery(tx)
        .where('invitations.tokenHash', '=', options.tokenHash)
        .forUpdate()
        .executeTakeFirst();

      if (!invitation) {
        return null;
      }

      const now = new Date();
      if (invitation.acceptedAt || invitation.revokedAt || new Date(invitation.expiresAt).getTime() <= now.getTime()) {
        // Re-check inside the row lock so concurrent accepts cannot create duplicate accounts from one token.
        return null;
      }

      const user = await tx
        .insertInto('users')
        .values({
          cursorColor: '#58cc02',
          email: invitation.email,
          name: options.name,
          passwordHash: options.passwordHash,
        })
        .returning(['id', 'email', 'name', 'cursorColor'])
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('organization_members')
        .values({
          createdById: invitation.invitedById,
          joinedAt: now,
          organizationId: invitation.organizationId,
          role: invitation.organizationRole,
          status: 'active',
          userId: user.id,
        })
        .execute();

      if (invitation.projectId && invitation.projectRole) {
        await tx
          .insertInto('project_members')
          .values({
            createdById: invitation.invitedById,
            projectId: invitation.projectId,
            role: invitation.projectRole,
            userId: user.id,
          })
          .execute();
      }

      await tx
        .updateTable('invitations')
        .set({
          acceptedAt: now,
          acceptedById: user.id,
        })
        .where('id', '=', invitation.id)
        .execute();

      const acceptedInvitation = await this.getByIdWith(tx, invitation.id);
      return acceptedInvitation ? { invitation: acceptedInvitation, user } : null;
    });
  }

  private getById(id: string): Promise<InvitationRecord | undefined> {
    return this.getByIdWith(this.db, id);
  }

  private async getByIdWith(db: Kysely<DB> | Transaction<DB>, id: string): Promise<InvitationRecord | undefined> {
    const row = await this.getInvitationQuery(db).where('invitations.id', '=', id).executeTakeFirst();

    return row ? this.toInvitationRecord(row) : undefined;
  }

  private getInvitationQuery(db: Kysely<DB> | Transaction<DB>) {
    return db
      .selectFrom('invitations')
      .innerJoin('organizations', 'organizations.id', 'invitations.organizationId')
      .innerJoin('users as invited_by', 'invited_by.id', 'invitations.invitedById')
      .leftJoin('projects', 'projects.id', 'invitations.projectId')
      .select([
        'invitations.id',
        'invitations.email',
        'invitations.organizationId',
        'organizations.name as organizationName',
        'organizations.slug as organizationSlug',
        'invitations.organizationRole',
        'invitations.projectId',
        'projects.name as projectName',
        'invitations.projectRole',
        'invitations.message',
        'invitations.invitedById',
        'invited_by.name as invitedByName',
        'invitations.acceptedById',
        'invitations.acceptedAt',
        'invitations.revokedAt',
        'invitations.expiresAt',
        'invitations.createdAt',
      ]);
  }

  private toInvitationRecord(row: {
    acceptedAt: Date | string | null;
    acceptedById: string | null;
    createdAt: Date | string;
    email: string;
    expiresAt: Date | string;
    id: string;
    invitedById: string;
    invitedByName: string;
    message: string | null;
    organizationId: string;
    organizationName: string;
    organizationRole: string;
    organizationSlug: string;
    projectId: string | null;
    projectName: string | null;
    projectRole: ProjectRole | string | null;
    revokedAt: Date | string | null;
  }): InvitationRecord {
    return {
      ...row,
      // Database check constraint menjaga value role; cast ini mengangkat text DB menjadi union domain untuk service/DTO.
      organizationRole: row.organizationRole as OrganizationRole.Admin | OrganizationRole.Member,
      projectRole: row.projectRole as ProjectRole.Editor | ProjectRole.Commenter | ProjectRole.Viewer | null,
    };
  }
}
