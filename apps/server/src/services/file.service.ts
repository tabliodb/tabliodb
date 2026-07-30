import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReadStream } from 'node:fs';
import { ConfigRepository } from '../repositories/config.repository.js';
import { FileRepository } from '../repositories/file.repository.js';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const AVATAR_MIME_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export type UploadedAvatarFile = {
  buffer?: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

export type ReadyAvatarFile = {
  byteSize: string;
  checksumSha256: string | null;
  mimeType: string;
  stream: ReadStream;
};

@Injectable()
export class FileService {
  private readonly storageRoot: string;

  constructor(
    @Inject(ConfigRepository)
    private readonly configRepository: ConfigRepository,
    @Inject(FileRepository)
    private readonly fileRepository: FileRepository,
  ) {
    this.storageRoot = path.resolve(this.configRepository.getEnv().storage.localPath);
  }

  async uploadUserAvatar(userId: string, file: UploadedAvatarFile | undefined): Promise<void> {
    const upload = this.validateAvatarFile(file);
    const fileId = randomUUID();
    const storageKey = `avatars/${userId}/${fileId}${upload.extension}`;
    const absolutePath = this.resolveStoragePath(storageKey);

    // Store the object before the database update, then remove it again if the
    // transaction fails so local development does not accumulate orphan files.
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, upload.buffer);

    try {
      const { oldFile } = await this.fileRepository.replaceUserAvatar({
        byteSize: upload.buffer.length,
        checksumSha256: upload.checksumSha256,
        height: null,
        id: fileId,
        kind: 'avatar',
        metadata: {},
        mimeType: upload.mimeType,
        originalName: upload.originalName,
        ownerId: userId,
        status: 'ready',
        storageKey,
        width: null,
      });

      if (oldFile) {
        await this.deleteStorageObject(oldFile.storageKey);
      }
    } catch (error) {
      await this.deleteStorageObject(storageKey);
      throw error;
    }
  }

  async clearUserAvatar(userId: string): Promise<void> {
    const oldFile = await this.fileRepository.clearUserAvatar(userId);

    if (oldFile) {
      await this.deleteStorageObject(oldFile.storageKey);
    }
  }

  async getReadyAvatarFile(fileId: string): Promise<ReadyAvatarFile> {
    const file = await this.fileRepository.getReadyAvatarById(fileId);

    if (!file) {
      throw new NotFoundException('Avatar file was not found');
    }

    const absolutePath = this.resolveStoragePath(file.storageKey);
    const fileStat = await stat(absolutePath).catch(() => null);

    if (!fileStat?.isFile()) {
      throw new NotFoundException('Avatar file was not found');
    }

    return {
      byteSize: String(file.byteSize),
      checksumSha256: file.checksumSha256,
      mimeType: file.mimeType,
      stream: createReadStream(absolutePath),
    };
  }

  private validateAvatarFile(file: UploadedAvatarFile | undefined) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Avatar image is required');
    }

    if (file.buffer.length > AVATAR_MAX_BYTES || (file.size ?? file.buffer.length) > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Avatar image must be 2MB or smaller');
    }

    const mimeType = file.mimetype ?? '';
    const extension = AVATAR_MIME_TYPES.get(mimeType);

    // MIME alone comes from the client, so the first bytes are checked too.
    // This keeps a renamed script or text file from being accepted as an image.
    if (!extension || !this.matchesImageSignature(file.buffer, mimeType)) {
      throw new BadRequestException('Avatar must be a PNG, JPEG, or WebP image');
    }

    return {
      buffer: file.buffer,
      checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
      extension,
      mimeType,
      originalName: path.basename(file.originalname ?? 'avatar').slice(0, 255),
    };
  }

  private matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );
    }

    if (mimeType === 'image/jpeg') {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (mimeType === 'image/webp') {
      return (
        buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
      );
    }

    return false;
  }

  private resolveStoragePath(storageKey: string): string {
    const absolutePath = path.resolve(this.storageRoot, storageKey);
    const insideStorageRoot =
      absolutePath === this.storageRoot || absolutePath.startsWith(`${this.storageRoot}${path.sep}`);

    // Every generated/read storage key must stay inside TABLIODB_STORAGE_PATH.
    // This protects future file routes from path traversal mistakes.
    if (!insideStorageRoot) {
      throw new BadRequestException('Invalid storage key');
    }

    return absolutePath;
  }

  private async deleteStorageObject(storageKey: string): Promise<void> {
    await rm(this.resolveStoragePath(storageKey), { force: true }).catch(() => undefined);
  }
}
