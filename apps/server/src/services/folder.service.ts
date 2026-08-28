import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole, Permission, AccessRole, isGranted, permissionsForAccessRole } from '@tabliodb/shared';
import { AuditAction } from '../constants.js';
import { AuthContext } from '../database.js';
import {
  FolderArchiveResponseDto,
  FolderCreateDto,
  FolderListQueryDto,
  FolderListResponseDto,
  FolderAccessCreateDto,
  FolderAccessDto,
  FolderAccessListQueryDto,
  FolderAccessListResponseDto,
  FolderAccessRemoveResponseDto,
  FolderAccessUpdateDto,
  FolderOwnershipTransferDto,
  FolderResponseDto,
  FolderUpdateDto,
} from '../dtos/folder.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { FolderRepository } from '../repositories/folder.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';

@Injectable()
export class FolderService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly folderRepository: FolderRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getAll(auth: AuthContext, query: FolderListQueryDto): Promise<FolderListResponseDto> {
    this.assertApiKeyScope(auth, Permission.FolderRead);

    const folders = await this.folderRepository.getVisibleToUser(auth.user.id, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      organizationId: query.organizationId,
    });

    return {
      ...folders,
      items: folders.items.map((folder) => this.serializeFolder(folder)),
    };
  }

  async create(auth: AuthContext, dto: FolderCreateDto) {
    this.assertApiKeyScope(auth, Permission.FolderCreate);

    const organization = await this.organizationRepository.getByIdForUser(auth.user.id, dto.organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Folder creation is intentionally workspace-explicit so self-hosted/internal accounts do not get surprise personal workspaces.
    await this.assertCanCreateFolder(auth, organization.id, organization.allowMemberFolderCreate);

    const folder = await this.createFolderOrThrowConflict({
      createdById: auth.user.id,
      description: dto.description ?? null,
      name: dto.name,
      organizationId: organization.id,
      slug: slugify(dto.name),
    });

    await this.recordFolderAudit(auth, {
      action: AuditAction.FolderCreated,
      entityId: folder.id,
      entityType: 'folder',
      metadata: {
        description: folder.description,
        name: folder.name,
        slug: folder.slug,
      },
      organizationId: folder.organizationId,
      folderId: folder.id,
    });

    return this.serializeFolder(folder);
  }

  async update(auth: AuthContext, folderId: string, dto: FolderUpdateDto): Promise<FolderResponseDto> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('At least one folder field is required');
    }

    const nextName = dto.name?.trim();
    if (dto.name !== undefined && !nextName) {
      throw new BadRequestException('Folder name is required');
    }

    await this.requireFolder(auth, folderId, Permission.FolderUpdate);

    const folder = await this.folderRepository.update(auth.user.id, folderId, {
      description: dto.description === undefined ? undefined : dto.description?.trim() || null,
      name: nextName,
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return this.serializeFolder(folder);
  }

  async archive(auth: AuthContext, folderId: string): Promise<FolderArchiveResponseDto> {
    const folder = await this.requireFolder(auth, folderId, Permission.FolderDelete);
    const archived = await this.folderRepository.archive(folderId);

    if (!archived) {
      throw new NotFoundException('Folder not found');
    }

    await this.recordFolderAudit(auth, {
      action: AuditAction.FolderArchived,
      entityId: folder.id,
      entityType: 'folder',
      metadata: {
        name: folder.name,
        slug: folder.slug,
      },
      organizationId: folder.organizationId,
      folderId: folder.id,
    });

    return { successful: true };
  }

  async getAccessList(
    auth: AuthContext,
    folderId: string,
    query: FolderAccessListQueryDto,
  ): Promise<FolderAccessListResponseDto> {
    await this.requireFolder(auth, folderId, Permission.FolderAccessManage);

    const members = await this.folderRepository.getAccessList(folderId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...members,
      items: members.items.map((member) => this.serializeAccess(member)),
    };
  }

  async addAccess(auth: AuthContext, folderId: string, dto: FolderAccessCreateDto): Promise<FolderAccessDto> {
    const folder = await this.requireFolder(auth, folderId, Permission.FolderAccessManage);
    this.assertAssignableFolderAccessRole(dto.role ?? AccessRole.Viewer);
    const user = await this.userRepository.getByEmail(dto.email);

    if (!user) {
      throw new NotFoundException('User not found. Create an invitation for new users first.');
    }

    if (user.id === auth.user.id) {
      throw new BadRequestException('You already have access to this folder');
    }

    const workspaceMember = await this.organizationRepository.addMemberIfAbsent({
      createdById: auth.user.id,
      organizationId: folder.organizationId,
      // Folder-level access is allowed to invite existing users into the workspace, but only as guests so no broader workspace access is leaked.
      role: OrganizationRole.Guest,
      userId: user.id,
    });

    if (!workspaceMember) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspaceMember.status !== 'active') {
      throw new BadRequestException('User is not an active workspace member');
    }

    const existingAccess = await this.folderRepository.getAccess(folderId, user.id);
    const member = await this.folderRepository.upsertAccess(folderId, {
      createdById: auth.user.id,
      role: dto.role ?? AccessRole.Viewer,
      userId: user.id,
    });

    if (!member) {
      throw new NotFoundException('Folder access could not be loaded');
    }

    if (!existingAccess) {
      await this.recordFolderAudit(auth, {
        action: AuditAction.FolderAccessAdded,
        entityId: user.id,
        entityType: 'folder_access',
        metadata: {
          email: user.email,
          name: user.name,
          role: member.role,
        },
        organizationId: folder.organizationId,
        folderId,
      });
    } else if (existingAccess.role !== member.role) {
      await this.recordFolderAudit(auth, {
        action: AuditAction.FolderAccessRoleUpdated,
        entityId: user.id,
        entityType: 'folder_access',
        metadata: {
          email: user.email,
          name: user.name,
          role: {
            after: member.role,
            before: existingAccess.role,
          },
        },
        organizationId: folder.organizationId,
        folderId,
      });
    }

    return this.serializeAccess(member);
  }

  async updateAccess(
    auth: AuthContext,
    folderId: string,
    userId: string,
    dto: FolderAccessUpdateDto,
  ): Promise<FolderAccessDto> {
    const folder = await this.requireFolder(auth, folderId, Permission.FolderAccessManage);
    this.assertNotSelfAccessMutation(auth, userId, 'change your own folder access');
    this.assertAssignableFolderAccessRole(dto.role);
    const currentAccess = await this.assertCanEditFolderAccessRole(folderId, userId);

    const member = await this.folderRepository.updateAccess(folderId, userId, dto.role);
    if (!member) {
      throw new NotFoundException('Folder access not found');
    }

    if (currentAccess.role !== member.role) {
      await this.recordFolderAudit(auth, {
        action: AuditAction.FolderAccessRoleUpdated,
        entityId: userId,
        entityType: 'folder_access',
        metadata: {
          email: member.email,
          name: member.name,
          role: {
            after: member.role,
            before: currentAccess.role,
          },
        },
        organizationId: folder.organizationId,
        folderId,
      });
    }

    return this.serializeAccess(member);
  }

  async transferOwnership(
    auth: AuthContext,
    folderId: string,
    dto: FolderOwnershipTransferDto,
  ): Promise<FolderAccessDto> {
    const folder = await this.requireFolder(auth, folderId, Permission.FolderAccessManage);

    if (auth.user.id === dto.userId) {
      throw new BadRequestException('Choose another collaborator to receive folder ownership');
    }

    const workspaceMember = await this.organizationRepository.getMember(folder.organizationId, dto.userId);
    if (!workspaceMember || workspaceMember.status !== 'active') {
      throw new BadRequestException('New folder owner must be an active workspace member');
    }

    const effectiveRole = await this.folderRepository.getAccessRole(dto.userId, folderId);
    if (!effectiveRole) {
      throw new BadRequestException('New folder owner must already have folder access');
    }

    const currentAccess = await this.folderRepository.getAccess(folderId, dto.userId);
    if (currentAccess?.role === AccessRole.Owner) {
      throw new BadRequestException('User already owns this folder');
    }

    const member = await this.folderRepository.transferOwnership(folderId, {
      createdById: auth.user.id,
      userId: dto.userId,
    });

    if (!member) {
      throw new NotFoundException('Folder access not found');
    }

    await this.recordFolderAudit(auth, {
      action: AuditAction.FolderAccessRoleUpdated,
      entityId: dto.userId,
      entityType: 'folder_access',
      metadata: {
        email: member.email,
        name: member.name,
        role: {
          after: member.role,
          before: currentAccess?.role ?? null,
        },
        // Ownership transfer is deliberately separated from regular role changes so audit history can flag it as sensitive.
        transfer: true,
      },
      organizationId: folder.organizationId,
      folderId,
    });

    return this.serializeAccess(member);
  }

  async removeAccess(auth: AuthContext, folderId: string, userId: string): Promise<FolderAccessRemoveResponseDto> {
    const folder = await this.requireFolder(auth, folderId, Permission.FolderAccessManage);
    this.assertNotSelfAccessMutation(auth, userId, 'remove your own folder access');
    const currentAccess = await this.folderRepository.getAccess(folderId, userId);
    if (!currentAccess) {
      throw new NotFoundException('Folder access not found');
    }

    if (
      currentAccess.role === AccessRole.Owner &&
      (await this.folderRepository.getFolderOwnerCount(folderId)) <= 1
    ) {
      throw new BadRequestException('Folder must keep at least one owner');
    }

    await this.folderRepository.removeAccess(folderId, userId);

    await this.recordFolderAudit(auth, {
      action: AuditAction.FolderAccessRemoved,
      entityId: userId,
      entityType: 'folder_access',
      metadata: {
        email: currentAccess.email,
        name: currentAccess.name,
        role: currentAccess.role,
      },
      organizationId: folder.organizationId,
      folderId,
    });

    return { successful: true };
  }

  async requireFolder(auth: AuthContext, folderId: string, permission: Permission = Permission.FolderRead) {
    this.assertApiKeyScope(auth, permission);

    const folder = await this.folderRepository.getByIdForUser(auth.user.id, folderId);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    this.assertAccessRole(folder.folderRole, permission);

    return folder;
  }

  private assertApiKeyScope(auth: AuthContext, permission: Permission): void {
    if (!auth.apiKey) {
      return;
    }

    if (!isGranted({ current: auth.apiKey.permissions, requested: [permission] })) {
      // Service-level checks protect internal callers and routes whose controller metadata can be bypassed in tests.
      throw new ForbiddenException(`${permission} API key scope is required`);
    }
  }

  private assertAccessRole(role: AccessRole, permission: Permission): void {
    if (!isGranted({ current: permissionsForAccessRole(role), requested: [permission] })) {
      throw new ForbiddenException(`${permission} permission is required`);
    }
  }

  private async assertCanCreateFolder(
    auth: AuthContext,
    organizationId: string,
    allowMemberFolderCreate: boolean,
  ): Promise<void> {
    if (allowMemberFolderCreate) {
      return;
    }

    const membership = await this.organizationRepository.getRole(auth.user.id, organizationId);
    if (membership?.role === OrganizationRole.Owner || membership?.role === OrganizationRole.Admin) {
      return;
    }

    throw new ForbiddenException('Workspace members cannot create folders');
  }

  private async createFolderOrThrowConflict(options: Parameters<FolderRepository['create']>[0]) {
    try {
      return await this.folderRepository.create(options);
    } catch (error) {
      if (isFolderSlugConflict(error)) {
        // Slug unik per workspace menjaga URL/navigasi stabil; duplicate name harus menjadi 409, bukan bocoran error Postgres.
        throw new ConflictException('A folder with this name already exists in this workspace');
      }

      throw error;
    }
  }

  private serializeFolder(folder: {
    createdAt: Date | string;
    description: string | null;
    id: string;
    name: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    folderRole: AccessRole;
    slug: string;
    updatedAt: Date | string;
  }): FolderResponseDto {
    return {
      ...folder,
      // Folder API contract memakai ISO string agar browser SDK tidak perlu menebak timezone dari Date object.
      createdAt: toIsoDateTime(folder.createdAt),
      updatedAt: toIsoDateTime(folder.updatedAt),
    };
  }

  private async assertCanEditFolderAccessRole(folderId: string, userId: string) {
    const currentAccess = await this.folderRepository.getAccess(folderId, userId);
    if (!currentAccess) {
      throw new NotFoundException('Folder access not found');
    }

    if (currentAccess.role === AccessRole.Owner) {
      throw new BadRequestException('Use transfer ownership to change a folder owner');
    }

    return currentAccess;
  }

  private assertAssignableFolderAccessRole(role: AccessRole): void {
    if (role !== AccessRole.Owner) {
      return;
    }

    // Owner stays outside add/update member flows; transferOwnership is the only path that can promote a folder owner.
    throw new BadRequestException('Use transfer ownership to assign a folder owner');
  }

  private assertNotSelfAccessMutation(auth: AuthContext, userId: string, action: string): void {
    if (auth.user.id !== userId) {
      return;
    }

    // Self role changes create a lockout/privilege loop; ownership transfer should be handled by another owner/admin flow.
    throw new BadRequestException(`Use another owner account to ${action}`);
  }

  private recordFolderAudit(
    auth: AuthContext,
    options: {
      action: AuditAction;
      entityId: string;
      entityType: string;
      metadata: Record<string, JsonValue>;
      organizationId: string;
      folderId: string;
    },
  ) {
    return this.auditLogRepository.create({
      action: options.action,
      actorId: auth.user.id,
      entityId: options.entityId,
      entityType: options.entityType,
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: options.metadata,
      organizationId: options.organizationId,
      folderId: options.folderId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private serializeAccess(member: {
    avatarUrl?: string | null;
    cursorColor: string;
    createdAt: Date | string;
    email: string;
    name: string;
    role: AccessRole;
    updatedAt: Date | string;
    userId: string;
  }): FolderAccessDto {
    return {
      ...member,
      avatarUrl: member.avatarUrl ?? null,
      // Member timestamps follow the rest of the API contract: ISO strings, never Date objects over JSON.
      createdAt: toIsoDateTime(member.createdAt),
      updatedAt: toIsoDateTime(member.updatedAt),
    };
  }
}

function isFolderSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: unknown; constraint?: unknown };

  return record.code === '23505' && record.constraint === 'folders_organization_id_slug_key';
}
