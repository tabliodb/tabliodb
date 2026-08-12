import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { PublicDiagramShareResponseDto } from '../dtos/share-link.dto.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { DiagramShareLinkService } from '../services/diagram-share-link.service.js';

@ApiTags('public-share-links')
@Controller('public/share-links')
export class PublicShareController {
  constructor(private readonly service: DiagramShareLinkService) {}

  @Get(':token')
  @RateLimit(RateLimitPreset.PublicShareRead)
  @ApiParam({ name: 'token', type: String })
  @ApiOperation({ operationId: 'getPublicDiagramShare' })
  @ZodResponse({ status: HttpStatus.OK, type: PublicDiagramShareResponseDto })
  getPublicDiagramShare(@Param('token') token: string) {
    return this.service.getPublicByToken(token);
  }
}
