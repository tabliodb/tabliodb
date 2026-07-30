import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrganizationRole, ProjectRole } from '@tabliodb/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import type { InvitationRecord } from '../repositories/invitation.repository.js';
import { InvitationService } from './invitation.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'owner@tabliodb.local',
    id: 'owner-id',
    name: 'Tabliodb Owner',
  },
};

const pendingInvitation: InvitationRecord = {
  acceptedAt: null,
  acceptedById: null,
  createdAt: new Date('2026-07-29T10:00:00.000Z'),
  email: 'new.user@tabliodb.local',
  expiresAt: new Date('2026-08-05T10:00:00.000Z'),
  id: 'invite-id',
  invitedById: 'owner-id',
  invitedByName: 'Tabliodb Owner',
  message: 'Welcome aboard',
  organizationId: 'organization-id',
  organizationName: 'Default Workspace',
  organizationRole: OrganizationRole.Member,
  organizationSlug: 'default-workspace',
  projectId: null,
  projectName: null,
  projectRole: null,
  revokedAt: null,
};

describe(InvitationService.name, () => {
  const authService = {
    createLoginResponse: vi.fn(),
    getCookieSecureDefault: vi.fn(),
  };
  const configRepository = {
    getEnv: vi.fn(),
  };
  const cryptoRepository = {
    hashBcrypt: vi.fn(),
    hashSha256: vi.fn(),
    randomBytesAsText: vi.fn(),
  };
  const invitationRepository = {
    acceptWithNewUser: vi.fn(),
    create: vi.fn(),
    getByTokenHash: vi.fn(),
  };
  const organizationRepository = {
    getByIdForUser: vi.fn(),
    getFirstForUser: vi.fn(),
  };
  const projectRepository = {
    getByIdForUser: vi.fn(),
  };
  const userRepository = {
    getAnyByEmail: vi.fn(),
    getInstanceRole: vi.fn(),
  };

  let service: InvitationService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));

    service = new InvitationService(
      authService as never,
      configRepository as never,
      cryptoRepository as never,
      invitationRepository as never,
      organizationRepository as never,
      projectRepository as never,
      userRepository as never,
    );

    authService.createLoginResponse.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        avatarUrl: null,
        cursorColor: '#58cc02',
        email: 'new.user@tabliodb.local',
        id: 'new-user-id',
        name: 'New User',
      },
    });
    configRepository.getEnv.mockReturnValue({ server: { publicUrl: 'http://localhost:4000/' } });
    cryptoRepository.hashBcrypt.mockResolvedValue('hashed-password');
    cryptoRepository.hashSha256.mockReturnValue(Buffer.from('hashed-token'));
    cryptoRepository.randomBytesAsText.mockReturnValue('invite-token');
    invitationRepository.create.mockResolvedValue(pendingInvitation);
    invitationRepository.getByTokenHash.mockResolvedValue(pendingInvitation);
    organizationRepository.getFirstForUser.mockResolvedValue({
      id: 'organization-id',
      name: 'Default Workspace',
    });
    userRepository.getAnyByEmail.mockResolvedValue(undefined);
    userRepository.getInstanceRole.mockResolvedValue({ role: 'owner' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a workspace invitation with a hashed one-time token', async () => {
    const result = await service.create(auth, {
      email: ' NEW.USER@TABLIODB.LOCAL ',
      expiresInDays: 7,
      message: ' Welcome aboard ',
      organizationRole: OrganizationRole.Member,
    });

    expect(result.token).toBe('invite-token');
    expect(result.acceptUrl).toBe('http://localhost:4000/invite/invite-token');
    expect(invitationRepository.create).toHaveBeenCalledWith({
      email: 'new.user@tabliodb.local',
      expiresAt: new Date('2026-08-05T12:00:00.000Z'),
      invitedById: 'owner-id',
      message: 'Welcome aboard',
      organizationId: 'organization-id',
      organizationRole: OrganizationRole.Member,
      projectId: null,
      projectRole: null,
      tokenHash: Buffer.from('hashed-token'),
    });
  });

  it('accepts a pending invitation by creating a user and session response', async () => {
    invitationRepository.acceptWithNewUser.mockResolvedValue({
      invitation: {
        ...pendingInvitation,
        acceptedAt: new Date('2026-07-29T12:01:00.000Z'),
        acceptedById: 'new-user-id',
      },
      user: {
        avatarUrl: null,
        cursorColor: '#58cc02',
        email: 'new.user@tabliodb.local',
        id: 'new-user-id',
        name: 'New User',
      },
    });

    const result = await service.accept({
      name: ' New User ',
      password: 'password-aman',
      token: 'invite-token',
    });

    expect(result.accessToken).toBe('session-token');
    expect(invitationRepository.acceptWithNewUser).toHaveBeenCalledWith({
      name: 'New User',
      passwordHash: 'hashed-password',
      tokenHash: Buffer.from('hashed-token'),
    });
  });

  it('rejects expired invitations before hashing a password', async () => {
    invitationRepository.getByTokenHash.mockResolvedValue({
      ...pendingInvitation,
      expiresAt: new Date('2026-07-28T12:00:00.000Z'),
    });

    await expect(
      service.accept({
        name: 'New User',
        password: 'password-aman',
        token: 'invite-token',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Expired tokens fail before password hashing so invalid invite attempts stay cheap.
    expect(cryptoRepository.hashBcrypt).not.toHaveBeenCalled();
    expect(invitationRepository.acceptWithNewUser).not.toHaveBeenCalled();
  });

  it('rejects invitation creation for an existing user email', async () => {
    userRepository.getAnyByEmail.mockResolvedValue({ email: 'new.user@tabliodb.local', id: 'existing-user-id' });

    await expect(
      service.create(auth, {
        email: 'new.user@tabliodb.local',
        expiresInDays: 7,
        organizationRole: OrganizationRole.Member,
        projectRole: ProjectRole.Viewer,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(invitationRepository.create).not.toHaveBeenCalled();
  });
});
