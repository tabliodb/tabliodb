import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { AVATAR_SERVE_VARIANT } from '../repositories/file.repository.js';
import { FileService } from './file.service.js';

describe(FileService.name, () => {
  const configRepository = {
    getEnv: vi.fn(),
  };
  const fileRepository = {
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
    service = new FileService(configRepository as never, fileRepository as never);
  });

  afterEach(async () => {
    await rm(storageRoot, { force: true, recursive: true });
  });

  it('processes avatar uploads into safe WebP objects and records a served variant', async () => {
    await service.uploadUserAvatar('user-id', {
      buffer: pngBuffer,
      mimetype: 'image/png',
      originalname: 'avatar.png',
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

  it('returns a stream only for ready avatar records that exist on disk', async () => {
    const storageKey = 'avatars/user-id/avatar.png';
    await mkdir(path.dirname(path.join(storageRoot, storageKey)), { recursive: true });
    await writeFile(path.join(storageRoot, storageKey), pngBuffer);
    fileRepository.getReadyAvatarById.mockResolvedValue({
      byteSize: String(pngBuffer.length),
      checksumSha256: 'checksum',
      mimeType: 'image/png',
      storageKey,
    });

    const file = await service.getReadyAvatarFile('file-id');

    expect(file.mimeType).toBe('image/png');
    expect(file.byteSize).toBe(String(pngBuffer.length));
    file.stream.destroy();
  });

  it('hides avatar records when the physical file is missing', async () => {
    fileRepository.getReadyAvatarById.mockResolvedValue({
      byteSize: '12',
      checksumSha256: 'checksum',
      mimeType: 'image/png',
      storageKey: 'avatars/user-id/missing.png',
    });

    await expect(service.getReadyAvatarFile('file-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
