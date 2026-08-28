import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationRole,
  Permission,
  AccessRole,
  isGranted,
  permissionsForOrganizationRole,
  permissionsForAccessRole,
} from '@tabliodb/shared';
import { SALT_ROUNDS } from '../constants.js';
import type { AuthContext } from '../database.js';
import {
  InvitationAcceptDto,
  InvitationAcceptResponseDto,
  InvitationCreateDto,
  InvitationCreateResponseDto,
  InvitationDto,
  InvitationPublicDto,
} from '../dtos/invitation.dto.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import { DiagramRepository } from '../repositories/diagram.repository.js';
import { InvitationRecord, InvitationRepository } from '../repositories/invitation.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { FolderRepository } from '../repositories/folder.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { toIsoDateTime, toNullableIsoDateTime } from '../utils/date-time.js';
import { AuthService } from './auth.service.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationService {
  constructor(
    private readonly authService: AuthService,
    private readonly configRepository: ConfigRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly diagramRepository: DiagramRepository,
    private readonly invitationRepository: InvitationRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly folderRepository: FolderRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(auth: AuthContext, dto: InvitationCreateDto): Promise<InvitationCreateResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.userRepository.getAnyByEmail(email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    if (dto.folderId && dto.diagramId) {
      throw new BadRequestException('Invitation can target either a folder folder or a diagram, not both');
    }

    const diagram = dto.diagramId ? await this.resolveDiagram(dto.diagramId) : null;
    const organization = await this.resolveOrganization(auth, dto, diagram?.organizationId);
    const folder = dto.folderId ? await this.resolveFolder(auth, dto.folderId, organization.id) : null;
    if (diagram && diagram.organizationId !== organization.id) {
      throw new BadRequestException('Diagram does not belong to the selected organization');
    }
    await this.requireInviteTargetPermission(auth, {
      diagramId: diagram?.id ?? null,
      organizationId: organization.id,
      folderId: folder?.id ?? null,
    });

    const token = this.cryptoRepository.randomBytesAsText(32);
    const invitation = await this.invitationRepository.create({
      diagramId: diagram?.id ?? null,
      // Diagram-only invites default to viewer so a share token does not grant write access by surprise.
      diagramRole: diagram ? (dto.diagramRole ?? AccessRole.Viewer) : null,
      email,
      expiresAt: new Date(Date.now() + dto.expiresInDays * ONE_DAY_MS),
      invitedById: auth.user.id,
      message: dto.message?.trim() || null,
      organizationId: organization.id,
      organizationRole: dto.organizationRole ?? (diagram ? OrganizationRole.Guest : OrganizationRole.Member),
      folderId: folder?.id ?? null,
      // Folder invite default sengaja editor agar invite ke folder langsung bisa produktif, sementara workspace-only invite tetap tanpa folder role.
      folderRole: folder ? (dto.folderRole ?? AccessRole.Editor) : null,
      tokenHash: this.cryptoRepository.hashSha256(token),
    });

    return {
      invitation: this.serializeInvitation(invitation),
      token,
      acceptUrl: this.buildAcceptUrl(token),
    };
  }

  async getByToken(token: string): Promise<InvitationPublicDto> {
    const invitation = await this.loadByToken(token);
    return this.serializePublicInvitation(invitation);
  }

  async accept(dto: InvitationAcceptDto): Promise<InvitationAcceptResponseDto> {
    const invitation = await this.loadByToken(dto.token);
    this.assertPending(invitation);

    const existingUser = await this.userRepository.getAnyByEmail(invitation.email);
    if (existingUser) {
      throw new ConflictException('This invitation email already belongs to an existing account');
    }

    const accepted = await this.invitationRepository.acceptWithNewUser({
      name: dto.name.trim(),
      passwordHash: await this.cryptoRepository.hashBcrypt(dto.password, SALT_ROUNDS),
      tokenHash: this.cryptoRepository.hashSha256(dto.token),
    });

    if (!accepted) {
      throw new NotFoundException('Invitation not found');
    }

    const login = await this.authService.createLoginResponse(accepted.user, {
      sessionBinding: dto.sessionBinding,
    });

    return {
      ...login,
      invitation: this.serializePublicInvitation(accepted.invitation),
    };
  }

  private async resolveOrganization(auth: AuthContext, dto: InvitationCreateDto, fallbackOrganizationId?: string) {
    const organization = fallbackOrganizationId
      ? await this.organizationRepository.getActiveById(fallbackOrganizationId)
      : dto.organizationId
        ? await this.organizationRepository.getByIdForUser(auth.user.id, dto.organizationId)
        : await this.organizationRepository.getFirstForUser(auth.user.id);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  private async resolveDiagram(diagramId: string) {
    const diagram = await this.diagramRepository.getById(diagramId);
    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return diagram;
  }

  private async resolveFolder(auth: AuthContext, folderId: string, organizationId: string) {
    const folder = await this.folderRepository.getByIdForUser(auth.user.id, folderId);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.organizationId !== organizationId) {
      throw new BadRequestException('Folder does not belong to the selected organization');
    }

    return folder;
  }

  private async loadByToken(token: string): Promise<InvitationRecord> {
    const invitation = await this.invitationRepository.getByTokenHash(this.cryptoRepository.hashSha256(token));
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  private assertPending(invitation: InvitationRecord): void {
    const status = this.getStatus(invitation);

    if (status !== 'pending') {
      throw new BadRequestException(`Invitation is ${status}`);
    }
  }

  getCookieSecureDefault(): boolean {
    return this.authService.getCookieSecureDefault();
  }

  private async requireInviteTargetPermission(
    auth: AuthContext,
    target: { diagramId: string | null; organizationId: string; folderId: string | null },
  ): Promise<void> {
    if (target.diagramId) {
      this.assertApiKeyScope(auth, Permission.DiagramMemberManage);
      const role = await this.folderRepository.getDiagramRole(auth.user.id, target.diagramId);
      this.assertFolderPermission(role?.role ?? null, Permission.DiagramMemberManage);
      return;
    }

    if (target.folderId) {
      this.assertApiKeyScope(auth, Permission.FolderAccessManage);
      const role = await this.folderRepository.getAccessRole(auth.user.id, target.folderId);
      this.assertFolderPermission(role?.role ?? null, Permission.FolderAccessManage);
      return;
    }

    this.assertApiKeyScope(auth, Permission.OrganizationManage);
    const role = await this.organizationRepository.getRole(auth.user.id, target.organizationId);
    if (
      !role ||
      !isGranted({
        current: permissionsForOrganizationRole(role.role as OrganizationRole),
        requested: [Permission.OrganizationManage],
      })
    ) {
      // Workspace invite follows workspace-admin permission instead of instance-admin permission.
      throw new ForbiddenException(`${Permission.OrganizationManage} permission is required`);
    }
  }

  private assertFolderPermission(role: AccessRole | null, permission: Permission): void {
    if (
      !role ||
      !isGranted({
        current: permissionsForAccessRole(role),
        requested: [permission],
      })
    ) {
      throw new ForbiddenException(`${permission} permission is required`);
    }
  }

  private assertApiKeyScope(auth: AuthContext, permission: Permission): void {
    if (!auth.apiKey) {
      return;
    }

    if (!isGranted({ current: auth.apiKey.permissions, requested: [permission] })) {
      // API key scope is checked at service-level too because invitation target permission is dynamic.
      throw new ForbiddenException(`${permission} API key scope is required`);
    }
  }

  private buildAcceptUrl(token: string): string {
    const publicUrl = this.configRepository.getEnv().server.publicUrl.replace(/\/+$/, '');
    return `${publicUrl}/invite/${token}`;
  }

  private serializeInvitation(invitation: InvitationRecord): InvitationDto {
    return {
      ...invitation,
      acceptedAt: toNullableIsoDateTime(invitation.acceptedAt),
      createdAt: toIsoDateTime(invitation.createdAt),
      expiresAt: toIsoDateTime(invitation.expiresAt),
      revokedAt: toNullableIsoDateTime(invitation.revokedAt),
      status: this.getStatus(invitation),
    };
  }

  private serializePublicInvitation(invitation: InvitationRecord): InvitationPublicDto {
    const serialized = this.serializeInvitation(invitation);

    return {
      email: serialized.email,
      expiresAt: serialized.expiresAt,
      message: serialized.message,
      organizationName: serialized.organizationName,
      organizationRole: serialized.organizationRole,
      diagramName: serialized.diagramName,
      diagramRole: serialized.diagramRole,
      folderName: serialized.folderName,
      folderRole: serialized.folderRole,
      status: serialized.status,
    };
  }

  private getStatus(invitation: InvitationRecord): InvitationDto['status'] {
    if (invitation.acceptedAt) {
      return 'accepted';
    }

    if (invitation.revokedAt) {
      return 'revoked';
    }

    if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
      return 'expired';
    }

    return 'pending';
  }
}
