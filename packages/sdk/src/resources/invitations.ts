import type { OrganizationRole, ProjectRole } from '@tabliodb/shared';
import type { RequestOpts } from '@oazapfts/runtime';
import type {
  InvitationAcceptDto as GeneratedInvitationAcceptDto,
  InvitationCreateDto as GeneratedInvitationCreateDto,
} from '../fetch-client.js';
import {
  acceptInvitation as acceptInvitationRequest,
  createInvitation as createInvitationRequest,
  getInvitationByToken,
} from '../fetch-client.js';
import type { LoginResponseDto } from './auth.js';

export type InvitationStatus = 'accepted' | 'expired' | 'pending' | 'revoked';

export type InvitationCreateDto = {
  email: string;
  expiresInDays?: number;
  message?: string;
  organizationId?: string;
  organizationRole?: OrganizationRole.Admin | OrganizationRole.Member;
  projectId?: string;
  projectRole?: ProjectRole.Commenter | ProjectRole.Editor | ProjectRole.Viewer;
};

export type InvitationDto = {
  acceptedAt: string | null;
  acceptedById: string | null;
  createdAt: string;
  email: string;
  expiresAt: string;
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
  projectRole: ProjectRole.Commenter | ProjectRole.Editor | ProjectRole.Viewer | null;
  revokedAt: string | null;
  status: InvitationStatus;
};

export type InvitationCreateResponseDto = {
  acceptUrl: string;
  invitation: InvitationDto;
  token: string;
};

export type InvitationPublicDto = {
  email: string;
  expiresAt: string;
  message: string | null;
  organizationName: string;
  organizationRole: OrganizationRole.Admin | OrganizationRole.Member;
  projectName: string | null;
  projectRole: ProjectRole.Commenter | ProjectRole.Editor | ProjectRole.Viewer | null;
  status: InvitationStatus;
};

export type InvitationAcceptDto = {
  name: string;
  password: string;
  token: string;
};

export type InvitationAcceptResponseDto = LoginResponseDto & {
  invitation: InvitationPublicDto;
};

export type InvitationsResource = {
  accept: (body: InvitationAcceptDto) => Promise<InvitationAcceptResponseDto>;
  create: (body: InvitationCreateDto) => Promise<InvitationCreateResponseDto>;
  getByToken: (token: string) => Promise<InvitationPublicDto>;
};

export function createInvitationsResource(opts?: RequestOpts): InvitationsResource {
  return {
    accept: (body: InvitationAcceptDto) =>
      // Generated OpenAPI enums stay behind the SDK resource boundary; app code uses shared domain enums.
      acceptInvitationRequest(
        { invitationAcceptDto: body as unknown as GeneratedInvitationAcceptDto },
        opts,
      ) as unknown as Promise<InvitationAcceptResponseDto>,
    create: (body: InvitationCreateDto) =>
      // The raw invitation token is returned only on create, mirroring API-key secret behavior.
      createInvitationRequest(
        { invitationCreateDto: body as unknown as GeneratedInvitationCreateDto },
        opts,
      ) as unknown as Promise<InvitationCreateResponseDto>,
    getByToken: (token: string) => getInvitationByToken({ token }, opts) as Promise<InvitationPublicDto>,
  };
}
