import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrganizationRole, Permission } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { UserService } from './user.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'owner@tabliodb.local',
    id: 'owner-id',
    name: 'Tabliodb Owner',
    passwordChangeRequired: false,
  },
};

const authWithReadApiKey: AuthContext = {
  ...auth,
  apiKey: {
    id: 'api-key-id',
    permissions: [Permission.OrganizationRead],
  },
};

describe(UserService.name, () => {
  const auditLogRepository = {
    create: vi.fn(),
  };
  const cryptoRepository = {
    hashBcrypt: vi.fn(),
  };
  const organizationRepository = {
    getByIdForUser: vi.fn(),
    getFirstForUser: vi.fn(),
  };
  const userRepository = {
    createManagedUser: vi.fn(),
    getAnyByEmail: vi.fn(),
    getEnabledInstanceOwnerCount: vi.fn(),
    getInstanceRole: vi.fn(),
    getManagedUserById: vi.fn(),
    listManagedUsers: vi.fn(),
    updateDisabledStatus: vi.fn(),
    updatePasswordHash: vi.fn(),
  };
  const sessionRepository = {
    revokeAllForUser: vi.fn(),
  };

  let service: UserService;

  beforeEach(() => {
    vi.resetAllMocks();

    service = new UserService(
      auditLogRepository as never,
      cryptoRepository as never,
      organizationRepository as never,
      sessionRepository as never,
      userRepository as never,
    );

    userRepository.getInstanceRole.mockResolvedValue({ role: 'owner' });
    userRepository.getAnyByEmail.mockResolvedValue(undefined);
    userRepository.getEnabledInstanceOwnerCount.mockResolvedValue(2);
    organizationRepository.getFirstForUser.mockResolvedValue({
      id: 'organization-id',
      name: 'Default Workspace',
    });
    cryptoRepository.hashBcrypt.mockResolvedValue('hashed-password');
    userRepository.createManagedUser.mockResolvedValue(createManagedUserRow({ id: 'created-user-id' }));
    sessionRepository.revokeAllForUser.mockResolvedValue(3);
  });

  it('creates a managed organization member from an instance owner', async () => {
    const result = await service.create(auth, {
      email: ' NEW.USER@TABLIODB.LOCAL ',
      name: ' New User ',
      password: 'password-aman',
    });

    expect(result).toMatchObject({
      createdAt: '2026-07-29T10:00:00.000Z',
      id: 'created-user-id',
      updatedAt: '2026-07-29T10:00:00.000Z',
    });
    expect(userRepository.createManagedUser).toHaveBeenCalledWith({
      cursorColor: '#1cb0f6',
      createdById: 'owner-id',
      email: 'new.user@tabliodb.local',
      instanceRole: undefined,
      name: 'New User',
      organizationId: 'organization-id',
      organizationRole: OrganizationRole.Member,
      passwordHash: 'hashed-password',
    });
  });

  it('lists managed users with a clamped pagination contract', async () => {
    userRepository.listManagedUsers.mockResolvedValue({
      items: [],
      nextCursor: null,
      totalCount: 0,
    });

    await expect(service.getAll(auth, { limit: 500 })).resolves.toEqual({
      items: [],
      nextCursor: null,
      totalCount: 0,
    });

    expect(userRepository.listManagedUsers).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 100,
      role: undefined,
      search: undefined,
    });
  });

  it('blocks low-scope API keys before instance admin lookup', async () => {
    await expect(service.getAll(authWithReadApiKey, { limit: 10 })).rejects.toBeInstanceOf(ForbiddenException);

    // Scope rejection happens before instance-role lookup so low-scope automation cannot probe admin state.
    expect(userRepository.getInstanceRole).not.toHaveBeenCalled();
    expect(userRepository.listManagedUsers).not.toHaveBeenCalled();
  });

  it('blocks instance admin creation from a non-owner instance admin', async () => {
    userRepository.getInstanceRole.mockResolvedValue({ role: 'admin' });

    await expect(
      service.create(auth, {
        email: 'admin@tabliodb.local',
        instanceRole: 'admin',
        name: 'Instance Admin',
        password: 'password-aman',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Hashing dan insert tidak boleh berjalan kalau actor tidak cukup kuat untuk menaikkan instance role.
    expect(cryptoRepository.hashBcrypt).not.toHaveBeenCalled();
    expect(userRepository.createManagedUser).not.toHaveBeenCalled();
  });

  it('rejects duplicate email before writing a new user', async () => {
    userRepository.getAnyByEmail.mockResolvedValue({
      deletedAt: null,
      email: 'existing@tabliodb.local',
      id: 'existing-user-id',
    });

    await expect(
      service.create(auth, {
        email: 'existing@tabliodb.local',
        name: 'Existing User',
        password: 'password-aman',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Duplicate email berhenti sebelum lookup organisasi agar error yang keluar tetap spesifik dan murah.
    expect(organizationRepository.getFirstForUser).not.toHaveBeenCalled();
    expect(userRepository.createManagedUser).not.toHaveBeenCalled();
  });

  it('disables a managed user and revokes active sessions immediately', async () => {
    const currentUser = createManagedUserRow({ id: 'target-user-id', isDisabled: false });
    const disabledUser = createManagedUserRow({ id: 'target-user-id', isDisabled: true });

    userRepository.getManagedUserById.mockResolvedValue(currentUser);
    userRepository.updateDisabledStatus.mockResolvedValue(disabledUser);

    await expect(service.updateStatus(auth, 'target-user-id', { isDisabled: true })).resolves.toMatchObject({
      id: 'target-user-id',
      isDisabled: true,
    });

    expect(userRepository.updateDisabledStatus).toHaveBeenCalledWith('target-user-id', true);
    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('target-user-id');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.disabled',
        entityId: 'target-user-id',
        entityType: 'user',
        metadata: expect.objectContaining({
          revokedSessions: 3,
        }),
      }),
    );
  });

  it('prevents disabling the last enabled instance owner', async () => {
    userRepository.getManagedUserById.mockResolvedValue(
      createManagedUserRow({ id: 'another-owner-id', instanceRole: 'owner', isDisabled: false }),
    );
    userRepository.getEnabledInstanceOwnerCount.mockResolvedValue(1);

    await expect(service.updateStatus(auth, 'another-owner-id', { isDisabled: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(userRepository.updateDisabledStatus).not.toHaveBeenCalled();
    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('resets a user password and revokes existing sessions', async () => {
    userRepository.getManagedUserById.mockResolvedValue(createManagedUserRow({ id: 'target-user-id' }));
    userRepository.updatePasswordHash.mockResolvedValue(createManagedUserRow({ id: 'target-user-id' }));

    await expect(
      service.resetPassword(auth, 'target-user-id', {
        password: 'password-baru',
      }),
    ).resolves.toEqual({ revokedSessions: 3, successful: true });

    expect(cryptoRepository.hashBcrypt).toHaveBeenCalledWith('password-baru', 12);
    expect(userRepository.updatePasswordHash).toHaveBeenCalledWith('target-user-id', 'hashed-password', {
      passwordChangeRequired: true,
    });
    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('target-user-id');
  });

  it('blocks non-owner instance admins from managing instance admins', async () => {
    userRepository.getInstanceRole.mockResolvedValue({ role: 'admin' });
    userRepository.getManagedUserById.mockResolvedValue(
      createManagedUserRow({ id: 'target-admin-id', instanceRole: 'admin' }),
    );

    await expect(service.revokeSessions(auth, 'target-admin-id')).rejects.toBeInstanceOf(ForbiddenException);

    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });
});

function createManagedUserRow(
  overrides: Partial<{
    cursorColor: string;
    createdAt: Date;
    email: string;
    id: string;
    instanceRole: 'admin' | 'owner' | null;
    isDisabled: boolean;
    name: string;
    passwordChangeRequired: boolean;
    updatedAt: Date;
  }> = {},
) {
  return {
    avatarUrl: null,
    cursorColor: overrides.cursorColor ?? '#1cb0f6',
    createdAt: overrides.createdAt ?? new Date('2026-07-29T10:00:00.000Z'),
    email: overrides.email ?? 'target@tabliodb.local',
    id: overrides.id ?? 'target-user-id',
    instanceRole: overrides.instanceRole ?? null,
    isDisabled: overrides.isDisabled ?? false,
    name: overrides.name ?? 'Target User',
    passwordChangeRequired: overrides.passwordChangeRequired ?? false,
    organizations: [
      {
        id: 'organization-id',
        name: 'Default Workspace',
        role: OrganizationRole.Member,
        slug: 'default-workspace',
        status: 'active',
      },
    ],
    updatedAt: overrides.updatedAt ?? new Date('2026-07-29T10:00:00.000Z'),
  };
}
