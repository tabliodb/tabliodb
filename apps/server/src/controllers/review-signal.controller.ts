import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  ReviewSignalEffectiveSettingsDto,
  ReviewSignalListQueryDto,
  ReviewSignalListResponseDto,
  ReviewSignalResponseDto,
  ReviewSignalSettingsDto,
} from '../dtos/review-signal.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { ReviewSignalService } from '../services/review-signal.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('review-signals')
@Controller('review-signals')
@Authenticated()
export class ReviewSignalController {
  constructor(private readonly service: ReviewSignalService) {}

  @Get('diagram/:diagramId')
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiQuery({ name: 'includeIgnored', required: false, type: Boolean })
  @ApiOperation({ operationId: 'getDiagramReviewSignals' })
  @ZodResponse({ status: HttpStatus.OK, type: ReviewSignalListResponseDto })
  getDiagramReviewSignals(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: ReviewSignalListQueryDto,
  ) {
    return this.service.getByDiagram(auth, diagramId, query);
  }

  @Get('diagram/:diagramId/settings')
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiOperation({ operationId: 'getDiagramReviewSignalSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: ReviewSignalEffectiveSettingsDto })
  getDiagramReviewSignalSettings(@Auth() auth: AuthContext, @Param('diagramId') diagramId: string) {
    return this.service.getDiagramSettings(auth, diagramId);
  }

  @Patch('diagram/:diagramId/settings')
  @RateLimit(RateLimitPreset.ReviewSignalWrite)
  @RequirePermission(Permission.DiagramUpdate, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiBody({ type: ReviewSignalSettingsDto })
  @ApiOperation({ operationId: 'updateDiagramReviewSignalSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: ReviewSignalEffectiveSettingsDto })
  updateDiagramReviewSignalSettings(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Body() dto: ReviewSignalSettingsDto,
  ) {
    return this.service.updateDiagramSettings(auth, diagramId, dto);
  }

  @Post(':signalId/ignore')
  @RateLimit(RateLimitPreset.ReviewSignalWrite)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'signalId', type: String })
  @ApiOperation({ operationId: 'ignoreReviewSignal' })
  @ZodResponse({ status: HttpStatus.OK, type: ReviewSignalResponseDto })
  ignoreReviewSignal(@Auth() auth: AuthContext, @Param('signalId') signalId: string) {
    return this.service.ignore(auth, signalId);
  }

  @Post(':signalId/unignore')
  @RateLimit(RateLimitPreset.ReviewSignalWrite)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'signalId', type: String })
  @ApiOperation({ operationId: 'unignoreReviewSignal' })
  @ZodResponse({ status: HttpStatus.OK, type: ReviewSignalResponseDto })
  unignoreReviewSignal(@Auth() auth: AuthContext, @Param('signalId') signalId: string) {
    return this.service.unignore(auth, signalId);
  }
}
