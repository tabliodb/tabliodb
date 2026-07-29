import { ConflictException, ForbiddenException } from '@nestjs/common';
import { OrganizationRole } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { UserService } from './user.service.js';

const auth: AuthContext = {
  user: {
    avatarColor: null,
    email: 'owner@tabliodb.local',
    id: 'owner-id',
    name: 'Tabliodb Owner',
  },
};

describe(UserService.name, () => {
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
    getInstanceRole: vi.fn(),
    listManagedUsers: vi.fn(),
  };

  let service: UserService;

  beforeEach(() => {
    vi.resetAllMocks();

    service = new UserService(cryptoRepository as never, organizationRepository as never, userRepository as never);

    userRepository.getInstanceRole.mockResolvedValue({ role: 'owner' });
    userRepository.getAnyByEmail.mockResolvedValue(undefined);
    organizationRepository.getFirstForUser.mockResolvedValue({
      id: 'organization-id',
      name: 'Default Workspace',
    });
    cryptoRepository.hashBcrypt.mockResolvedValue('hashed-password');
    userRepository.createManagedUser.mockResolvedValue({
      id: 'created-user-id',
    });
  });

  it('creates a managed organization member from an instance owner', async () => {
    const result = await service.create(auth, {
      email: ' NEW.USER@TABLIODB.LOCAL ',
      name: ' New User ',
      password: 'password-aman',
    });

    expect(result).toEqual({ id: 'created-user-id' });
    expect(userRepository.createManagedUser).toHaveBeenCalledWith({
      avatarColor: '#1cb0f6',
      createdById: 'owner-id',
      email: 'new.user@tabliodb.local',
      instanceRole: undefined,
      name: 'New User',
      organizationId: 'organization-id',
      organizationRole: OrganizationRole.Member,
      passwordHash: 'hashed-password',
    });
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
});
