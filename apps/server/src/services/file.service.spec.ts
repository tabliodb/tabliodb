import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { AVATAR_SERVE_VARIANT } from '../repositories/file.repository.js';
import { AVATAR_MAX_BYTES, FileService } from './file.service.js';

describe(FileService.name, () => {
  const configRepository = {
    getEnv: vi.fn(),
  };
  const fileRepository = {
    canReadUserAvatar: vi.fn(),
    clearUserAvatar: vi.fn(),
    getReadyAvatarById: vi.fn(),
    replaceUserAvatar: vi.fn(),
  };

  let storageRoot: string;
  let pngBuffer: Buffer;
  let service: FileService;

  beforeEach(async () => {
    vi.resetAllMocks();
    pngBuffer = await sharp({
      create: {
        background: { alpha: 1, b: 58, g: 199, r: 88 },
        channels: 4,
        height: 4,
        width: 4,
      },
    })
      .png()
      .toBuffer();
    storageRoot = await mkdtemp(path.join(tmpdir(), 'tabliodb-avatar-test-'));
    configRepository.getEnv.mockReturnValue({
      storage: {
        localPath: storageRoot,
      },
    });
    fileRepository.replaceUserAvatar.mockResolvedValue({ file: { id: 'file-id' }, oldFile: null });
    fileRepository.canReadUserAvatar.mockResolvedValue(true);
    service = new FileService(configRepository as never, fileRepository as never);
  });

  afterEach(async () => {
    await rm(storageRoot, { force: true, recursive: true });
  });

  it('processes avatar uploads into safe WebP objects and records a served variant', async () => {
    await service.uploadUserAvatar('user-id', {
      buffer: pngBuffer,
      mimetype: 'image/png',
      originalname: 'C:\\fakepath\\avatar\u0000.png',
      size: pngBuffer.length,
    });

    const storedFile = fileRepository.replaceUserAvatar.mock.calls[0][0].file;
    const [storedVariant] = fileRepository.replaceUserAvatar.mock.calls[0][0].variants;

    expect(storedFile).toMatchObject({
      kind: 'avatar',
      metadata: {
        originalMimeType: 'image/png',
        processed: true,
        strippedMetadata: true,
      },
      mimeType: 'image/webp',
      originalName: 'avatar.png',
      ownerId: 'user-id',
      status: 'ready',
    });
    expect(storedFile.byteSize).toBeGreaterThan(0);
    expect(storedFile.checksumSha256).toHaveLength(64);
    expect(storedFile.storageKey).toMatch(/^avatars\/user-id\/.+\/original\.webp$/);
    await expect(readFile(path.join(storageRoot, storedFile.storageKey))).resolves.not.toEqual(pngBuffer);

    expect(storedVariant).toMatchObject({
      fileId: storedFile.id,
      height: 128,
      metadata: {
        generatedFrom: 'avatar-upload',
        strippedMetadata: true,
      },
      mimeType: 'image/webp',
      variant: AVATAR_SERVE_VARIANT,
      width: 128,
    });
    expect(storedVariant.byteSize).toBeGreaterThan(0);
    expect(storedVariant.metadata.checksumSha256).toHaveLength(64);
    expect(storedVariant.storageKey).toMatch(/^avatars\/user-id\/.+\/avatar_128\.webp$/);
    await expect(readFile(path.join(storageRoot, storedVariant.storageKey))).resolves.not.toEqual(pngBuffer);
  });

  it('rejects files whose MIME type and signature are not allowed', async () => {
    await expect(
      service.uploadUserAvatar('user-id', {
        buffer: Buffer.from('not-an-image'),
        mimetype: 'text/plain',
        originalname: 'avatar.txt',
        size: 12,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fileRepository.replaceUserAvatar).not.toHaveBeenCalled();
  });

  it('rejects avatar uploads without a real file buffer', async () => {
    await expect(
      service.uploadUserAvatar('user-id', {
        buffer: 'not-a-buffer' as never,
        mimetype: 'image/png',
        originalname: 'avatar.png',
        size: 12,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fileRepository.replaceUserAvatar).not.toHaveBeenCalled();
  });

  it('rejects avatar uploads that exceed the configured size limit', async () => {
    await expect(
      service.uploadUserAvatar('user-id', {
        buffer: Buffer.alloc(AVATAR_MAX_BYTES + 1),
        mimetype: 'image/png',
        originalname: 'avatar.png',
        size: AVATAR_MAX_BYTES + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fileRepository.replaceUserAvatar).not.toHaveBeenCalled();
  });

  it('rejects avatar uploads when the declared MIME type does not match the image signature', async () => {
    await expect(
      service.uploadUserAvatar('user-id', {
        buffer: pngBuffer,
        mimetype: 'image/jpeg',
        originalname: 'avatar.jpg',
        size: pngBuffer.length,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fileRepository.replaceUserAvatar).not.toHaveBeenCalled();
  });

  it('rejects corrupt images even when the first bytes look like an allowed image', async () => {
    const corruptPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('not a real png payload'),
    ]);

    await expect(
      service.uploadUserAvatar('user-id', {
        buffer: corruptPng,
        mimetype: 'image/png',
        originalname: 'avatar.png',
        size: corruptPng.length,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fileRepository.replaceUserAvatar).not.toHaveBeenCalled();
  });

  it('removes newly written avatar files when the database replacement fails', async () => {
    fileRepository.replaceUserAvatar.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.uploadUserAvatar('user-id', {
        buffer: pngBuffer,
        mimetype: 'image/png',
        originalname: 'avatar.png',
        size: pngBuffer.length,
      }),
    ).rejects.toThrow('database unavailable');

    const avatarOptions = fileRepository.replaceUserAvatar.mock.calls[0][0];
    const storedPaths = [
      avatarOptions.file.storageKey,
      ...avatarOptions.variants.map((variant: { storageKey: string }) => variant.storageKey),
    ];

    for (const storageKey of storedPaths) {
      await expect(stat(path.join(storageRoot, storageKey))).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('returns a stream only for ready avatar records that exist on disk', async () => {
    const storageKey = 'avatars/user-id/avatar.png';
    await mkdir(path.dirname(path.join(storageRoot, storageKey)), { recursive: true });
    await writeFile(path.join(storageRoot, storageKey), pngBuffer);
    fileRepository.getReadyAvatarById.mockResolvedValue({
      byteSize: String(pngBuffer.length),
      checksumSha256: 'checksum',
      mimeType: 'image/png',
      ownerId: 'user-id',
      storageKey,
    });

    const file = await service.getReadyAvatarFile('viewer-id', 'file-id');

    expect(file.mimeType).toBe('image/png');
    expect(file.byteSize).toBe(String(pngBuffer.length));
    expect(fileRepository.canReadUserAvatar).toHaveBeenCalledWith('viewer-id', 'user-id');
    file.stream.destroy();
  });

  it('rejects avatar reads when the viewer does not share an active workspace with the owner', async () => {
    const storageKey = 'avatars/user-id/avatar.png';
    await mkdir(path.dirname(path.join(storageRoot, storageKey)), { recursive: true });
    await writeFile(path.join(storageRoot, storageKey), pngBuffer);
    fileRepository.getReadyAvatarById.mockResolvedValue({
      byteSize: String(pngBuffer.length),
      checksumSha256: 'checksum',
      mimeType: 'image/png',
      ownerId: 'user-id',
      storageKey,
    });
    fileRepository.canReadUserAvatar.mockResolvedValue(false);

    await expect(service.getReadyAvatarFile('viewer-id', 'file-id')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides avatar records when the physical file is missing', async () => {
    fileRepository.getReadyAvatarById.mockResolvedValue({
      byteSize: '12',
      checksumSha256: 'checksum',
      mimeType: 'image/png',
      ownerId: 'user-id',
      storageKey: 'avatars/user-id/missing.png',
    });

    await expect(service.getReadyAvatarFile('viewer-id', 'file-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects avatar storage keys that escape the configured storage root', async () => {
    fileRepository.getReadyAvatarById.mockResolvedValue({
      byteSize: '12',
      checksumSha256: 'checksum',
      mimeType: 'image/png',
      ownerId: 'user-id',
      storageKey: '../outside-storage.png',
    });

    await expect(service.getReadyAvatarFile('viewer-id', 'file-id')).rejects.toBeInstanceOf(BadRequestException);
  });
});
