import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthContext } from '../database.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { FileService } from '../services/file.service.js';

@ApiTags('files')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get(':fileId')
  @Authenticated({ requireSessionProof: false })
  @ApiParam({ name: 'fileId', type: String })
  @ApiOperation({ operationId: 'getFile' })
  async getFile(@Auth() auth: AuthContext, @Param('fileId') fileId: string, @Res({ passthrough: true }) res: Response) {
    // Avatar images are loaded by the browser as native <img> subresources, which cannot attach the SDK-managed session-proof headers.
    // The endpoint remains authenticated and FileService still enforces owner/shared-workspace access before streaming the object.
    const file = await this.fileService.getReadyAvatarFile(auth.user.id, fileId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.byteSize);
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (file.checksumSha256) {
      res.setHeader('ETag', `"sha256-${file.checksumSha256}"`);
    }

    return new StreamableFile(file.stream);
  }
}
