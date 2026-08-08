import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { ReadStream } from 'node:fs';
import { ConfigRepository } from '../repositories/config.repository.js';
import { AVATAR_SERVE_VARIANT, FileRepository } from '../repositories/file.repository.js';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const AVATAR_PRIMARY_MAX_SIZE = 512;
const AVATAR_VARIANT_SIZE = 128;
const AVATAR_OUTPUT_EXTENSION = '.webp';
const AVATAR_OUTPUT_MIME_TYPE = 'image/webp';

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

type AvatarUploadCandidate = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

type ProcessedAvatarAsset = {
  buffer: Buffer;
  byteSize: number;
  checksumSha256: string;
  height: number;
  mimeType: typeof AVATAR_OUTPUT_MIME_TYPE;
  width: number;
};

type ProcessedAvatarUpload = {
  originalMimeType: string;
  originalName: string;
  primary: ProcessedAvatarAsset;
  variant: ProcessedAvatarAsset;
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
    const upload = await this.processAvatarUpload(this.validateAvatarFile(file));
    const fileId = randomUUID();
    const storageKey = `avatars/${userId}/${fileId}/original${AVATAR_OUTPUT_EXTENSION}`;
    const variantStorageKey = `avatars/${userId}/${fileId}/${AVATAR_SERVE_VARIANT}${AVATAR_OUTPUT_EXTENSION}`;
    const storageObjects = [
      { buffer: upload.primary.buffer, storageKey },
      { buffer: upload.variant.buffer, storageKey: variantStorageKey },
    ];

    // Store the object before the database update, then remove it again if the
    // transaction fails so local development does not accumulate orphan files.
    for (const storageObject of storageObjects) {
      await this.writeStorageObject(storageObject.storageKey, storageObject.buffer);
    }

    try {
      const { oldFile } = await this.fileRepository.replaceUserAvatar({
        file: {
          byteSize: upload.primary.byteSize,
          checksumSha256: upload.primary.checksumSha256,
          height: upload.primary.height,
          id: fileId,
          kind: 'avatar',
          metadata: {
            originalMimeType: upload.originalMimeType,
            processed: true,
            strippedMetadata: true,
          },
          mimeType: upload.primary.mimeType,
          originalName: upload.originalName,
          ownerId: userId,
          status: 'ready',
          storageKey,
          width: upload.primary.width,
        },
        variants: [
          {
            byteSize: upload.variant.byteSize,
            fileId,
            height: upload.variant.height,
            metadata: {
              checksumSha256: upload.variant.checksumSha256,
              generatedFrom: 'avatar-upload',
              strippedMetadata: true,
            },
            mimeType: upload.variant.mimeType,
            storageKey: variantStorageKey,
            variant: AVATAR_SERVE_VARIANT,
            width: upload.variant.width,
          },
        ],
      });

      if (oldFile) {
        await this.deleteStorageObjects([oldFile.storageKey, ...oldFile.variantStorageKeys]);
      }
    } catch (error) {
      await this.deleteStorageObjects(storageObjects.map((storageObject) => storageObject.storageKey));
      throw error;
    }
  }

  async clearUserAvatar(userId: string): Promise<void> {
    const oldFile = await this.fileRepository.clearUserAvatar(userId);

    if (oldFile) {
      await this.deleteStorageObjects([oldFile.storageKey, ...oldFile.variantStorageKeys]);
    }
  }

  async getReadyAvatarFile(viewerId: string, fileId: string): Promise<ReadyAvatarFile> {
    const file = await this.fileRepository.getReadyAvatarById(fileId);

    if (!file) {
      throw new NotFoundException('Avatar file was not found');
    }

    // Avatar URLs are exposed in collaboration/member responses, but a guessed UUID still needs a workspace relationship.
    if (!(await this.fileRepository.canReadUserAvatar(viewerId, file.ownerId))) {
      throw new ForbiddenException('Avatar file access is not allowed');
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

  private validateAvatarFile(file: UploadedAvatarFile | undefined): AvatarUploadCandidate {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Avatar image is required');
    }

    if (file.buffer.length > AVATAR_MAX_BYTES || (file.size ?? file.buffer.length) > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Avatar image must be 2MB or smaller');
    }

    const mimeType = file.mimetype ?? '';

    // MIME alone comes from the client, so the first bytes are checked too.
    // This keeps a renamed script or text file from being accepted as an image.
    if (!AVATAR_MIME_TYPES.has(mimeType) || !this.matchesImageSignature(file.buffer, mimeType)) {
      throw new BadRequestException('Avatar must be a PNG, JPEG, or WebP image');
    }

    return {
      buffer: file.buffer,
      mimeType,
      originalName: path.basename(file.originalname ?? 'avatar').slice(0, 255),
    };
  }

  private async processAvatarUpload(upload: AvatarUploadCandidate): Promise<ProcessedAvatarUpload> {
    try {
      return {
        originalMimeType: upload.mimeType,
        originalName: upload.originalName,
        primary: await this.createWebpAvatarAsset(upload.buffer, AVATAR_PRIMARY_MAX_SIZE, 'inside'),
        variant: await this.createWebpAvatarAsset(upload.buffer, AVATAR_VARIANT_SIZE, 'cover'),
      };
    } catch {
      throw new BadRequestException('Avatar image could not be processed');
    }
  }

  private async createWebpAvatarAsset(
    buffer: Buffer,
    size: number,
    fit: 'cover' | 'inside',
  ): Promise<ProcessedAvatarAsset> {
    const { data, info } = await sharp(buffer, {
      failOn: 'warning',
      limitInputPixels: 16_777_216,
    })
      .rotate()
      .resize({
        fit,
        height: size,
        position: fit === 'cover' ? sharp.strategy.attention : undefined,
        width: size,
        withoutEnlargement: fit === 'inside',
      })
      .webp({
        quality: fit === 'cover' ? 88 : 90,
      })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      byteSize: data.length,
      checksumSha256: createHash('sha256').update(data).digest('hex'),
      height: info.height,
      mimeType: AVATAR_OUTPUT_MIME_TYPE,
      width: info.width,
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

  private async writeStorageObject(storageKey: string, buffer: Buffer): Promise<void> {
    const absolutePath = this.resolveStoragePath(storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);
  }

  private async deleteStorageObjects(storageKeys: string[]): Promise<void> {
    await Promise.all(storageKeys.map((storageKey) => rm(this.resolveStoragePath(storageKey), { force: true }))).catch(
      () => undefined,
    );
  }
}
