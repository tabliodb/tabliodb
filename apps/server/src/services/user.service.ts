import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { SALT_ROUNDS } from '../constants.js';
import type { AuthContext } from '../database.js';
import { UserCreateDto, UserListQueryDto, UserListResponseDto } from '../dtos/user.dto.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { clampPaginationLimit } from '../utils/pagination.js';

@Injectable()
export class UserService {
  constructor(
    private readonly cryptoRepository: CryptoRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getAll(auth: AuthContext, query: UserListQueryDto): Promise<UserListResponseDto> {
    await this.requireInstanceManager(auth);

    return this.userRepository.listManagedUsers({
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      role: query.role,
      // Empty search diperlakukan seperti tanpa search agar query index-friendly saat field kosong.
      search: query.search?.trim() || undefined,
    });
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

    return this.userRepository.createManagedUser({
      avatarColor: '#1cb0f6',
      createdById: auth.user.id,
      email,
      instanceRole: dto.instanceRole,
      name: dto.name.trim(),
      organizationId: organization.id,
      organizationRole: dto.organizationRole ?? OrganizationRole.Member,
      passwordHash,
    });
  }

  private async requireInstanceManager(auth: AuthContext) {
    const instanceMember = await this.userRepository.getInstanceRole(auth.user.id);

    if (!instanceMember) {
      throw new ForbiddenException('Instance admin access is required');
    }

    return instanceMember.role;
  }
}
