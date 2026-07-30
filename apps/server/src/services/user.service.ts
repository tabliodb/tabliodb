import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { AuditAction, SALT_ROUNDS } from '../constants.js';
import type { AuthContext } from '../database.js';
import {
  UserCreateDto,
  UserListQueryDto,
  UserListResponseDto,
  UserPasswordResetDto,
  UserPasswordResetResponseDto,
  UserResponseDto,
  UserSessionRevokeResponseDto,
  UserStatusUpdateDto,
} from '../dtos/user.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { SessionRepository } from '../repositories/session.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';

@Injectable()
export class UserService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getAll(auth: AuthContext, query: UserListQueryDto): Promise<UserListResponseDto> {
    await this.requireInstanceManager(auth);

    const users = await this.userRepository.listManagedUsers({
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      role: query.role,
      // Empty search diperlakukan seperti tanpa search agar query index-friendly saat field kosong.
      search: query.search?.trim() || undefined,
    });

    return {
      ...users,
      items: users.items.map((user) => this.serializeManagedUser(user)),
    };
  }

  async create(auth: AuthContext, dto: UserCreateDto) {
    const actorInstanceRole = await this.requireInstanceManager(auth);
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.userRepository.getAnyByEmail(email);

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    if (dto.instanceRole && actorInstanceRole !== 'owner') {
      throw new ForbiddenException('Only instance owners can create instance admins');
    }

    const organization = dto.organizationId
      ? await this.organizationRepository.getByIdForUser(auth.user.id, dto.organizationId)
      : await this.organizationRepository.getFirstForUser(auth.user.id);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const passwordHash = await this.cryptoRepository.hashBcrypt(dto.password, SALT_ROUNDS);

    const user = await this.userRepository.createManagedUser({
      cursorColor: '#1cb0f6',
      createdById: auth.user.id,
      email,
      instanceRole: dto.instanceRole,
      name: dto.name.trim(),
      organizationId: organization.id,
      organizationRole: dto.organizationRole ?? OrganizationRole.Member,
      passwordHash,
    });

    if (!user) {
      throw new NotFoundException('Created user could not be loaded');
    }

    return this.serializeManagedUser(user);
  }

  async updateStatus(auth: AuthContext, userId: string, dto: UserStatusUpdateDto): Promise<UserResponseDto> {
    const actorInstanceRole = await this.requireInstanceManager(auth);
    const currentUser = await this.requireManagedUser(userId);

    this.assertCanManageUser(auth, actorInstanceRole, currentUser);

    if (dto.isDisabled && userId === auth.user.id) {
      throw new BadRequestException('Use another owner account before disabling your own user');
    }

    if (dto.isDisabled && currentUser.instanceRole === 'owner' && !currentUser.isDisabled) {
      await this.assertKeepsEnabledInstanceOwner();
    }

    if (currentUser.isDisabled === dto.isDisabled) {
      return this.serializeManagedUser(currentUser);
    }

    const user = await this.userRepository.updateDisabledStatus(userId, dto.isDisabled);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const revokedSessions = dto.isDisabled ? await this.sessionRepository.revokeAllForUser(userId) : 0;

    await this.recordUserAudit(auth, user, {
      action: dto.isDisabled ? AuditAction.UserDisabled : AuditAction.UserEnabled,
      metadata: {
        email: user.email,
        isDisabled: dto.isDisabled,
        name: user.name,
        revokedSessions,
      },
    });

    return this.serializeManagedUser(user);
  }

  async resetPassword(
    auth: AuthContext,
    userId: string,
    dto: UserPasswordResetDto,
  ): Promise<UserPasswordResetResponseDto> {
    const actorInstanceRole = await this.requireInstanceManager(auth);
    const currentUser = await this.requireManagedUser(userId);

    this.assertCanManageUser(auth, actorInstanceRole, currentUser);

    if (userId === auth.user.id) {
      throw new BadRequestException('Use account settings to change your own password');
    }

    const passwordHash = await this.cryptoRepository.hashBcrypt(dto.password, SALT_ROUNDS);
    const user = await this.userRepository.updatePasswordHash(userId, passwordHash);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const revokedSessions = await this.sessionRepository.revokeAllForUser(userId);

    await this.recordUserAudit(auth, user, {
      action: AuditAction.UserPasswordReset,
      metadata: {
        email: user.email,
        name: user.name,
        revokedSessions,
      },
    });

    return { revokedSessions, successful: true };
  }

  async revokeSessions(auth: AuthContext, userId: string): Promise<UserSessionRevokeResponseDto> {
    const actorInstanceRole = await this.requireInstanceManager(auth);
    const user = await this.requireManagedUser(userId);

    this.assertCanManageUser(auth, actorInstanceRole, user);

    if (userId === auth.user.id) {
      throw new BadRequestException('Use logout to end your own current session');
    }

    const revokedSessions = await this.sessionRepository.revokeAllForUser(userId);

    await this.recordUserAudit(auth, user, {
      action: AuditAction.UserSessionsRevoked,
      metadata: {
        email: user.email,
        name: user.name,
        revokedSessions,
      },
    });

    return { revokedSessions, successful: true };
  }

  private async requireInstanceManager(auth: AuthContext) {
    const instanceMember = await this.userRepository.getInstanceRole(auth.user.id);

    if (!instanceMember) {
      throw new ForbiddenException('Instance admin access is required');
    }

    return instanceMember.role;
  }

  private async requireManagedUser(userId: string): Promise<ManagedUserRow> {
    const user = await this.userRepository.getManagedUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private assertCanManageUser(auth: AuthContext, actorInstanceRole: 'admin' | 'owner', user: ManagedUserRow): void {
    if (user.instanceRole && actorInstanceRole !== 'owner') {
      throw new ForbiddenException('Only instance owners can manage instance administrators');
    }

    if (user.id === auth.user.id && actorInstanceRole !== 'owner') {
      throw new ForbiddenException('Only instance owners can manage their own administrative user');
    }
  }

  private async assertKeepsEnabledInstanceOwner(): Promise<void> {
    if ((await this.userRepository.getEnabledInstanceOwnerCount()) <= 1) {
      throw new BadRequestException('Tabliodb must keep at least one enabled instance owner');
    }
  }

  private recordUserAudit(
    auth: AuthContext,
    user: ManagedUserRow,
    options: {
      action: AuditAction;
      metadata: Record<string, JsonValue>;
    },
  ) {
    return this.auditLogRepository.create({
      action: options.action,
      actorId: auth.user.id,
      entityId: user.id,
      entityType: 'user',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: options.metadata,
      organizationId: user.organizations[0]?.id ?? null,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }

  private serializeManagedUser(user: ManagedUserRow) {
    return {
      ...user,
      // Admin UI dan generated SDK menerima timestamp sebagai string ISO, selaras dengan bentuk JSON response sebenarnya.
      createdAt: toIsoDateTime(user.createdAt),
      updatedAt: toIsoDateTime(user.updatedAt),
    };
  }
}

type ManagedUserRow = NonNullable<Awaited<ReturnType<UserRepository['getManagedUserById']>>>;
