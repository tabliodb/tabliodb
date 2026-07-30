import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileService } from './file.service.js';

const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

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
  let service: FileService;

  beforeEach(async () => {
    vi.resetAllMocks();
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

  it('stores a validated avatar file and records ready metadata', async () => {
    await service.uploadUserAvatar('user-id', {
      buffer: pngBuffer,
      mimetype: 'image/png',
      originalname: 'avatar.png',
      size: pngBuffer.length,
    });

    const storedFile = fileRepository.replaceUserAvatar.mock.calls[0][0];
    expect(storedFile).toMatchObject({
      byteSize: pngBuffer.length,
      kind: 'avatar',
      mimeType: 'image/png',
      ownerId: 'user-id',
      status: 'ready',
    });
    expect(storedFile.storageKey).toMatch(/^avatars\/user-id\/.+\.png$/);
    await expect(readFile(path.join(storageRoot, storedFile.storageKey))).resolves.toEqual(pngBuffer);
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
