import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Authenticated } from '../middleware/auth.guard.js';
import { FileService } from '../services/file.service.js';

@ApiTags('files')
@Controller('files')
@Authenticated()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get(':fileId')
  @ApiParam({ name: 'fileId', type: String })
  @ApiOperation({ operationId: 'getFile' })
  async getFile(@Param('fileId') fileId: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.fileService.getReadyAvatarFile(fileId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.byteSize);
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (file.checksumSha256) {
      res.setHeader('ETag', `"sha256-${file.checksumSha256}"`);
    }

    return new StreamableFile(file.stream);
  }
}
