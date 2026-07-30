import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  ReviewSignalListQueryDto,
  ReviewSignalListResponseDto,
  ReviewSignalResponseDto,
} from '../dtos/review-signal.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
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
  @ZodResponse({ type: ReviewSignalListResponseDto })
  getDiagramReviewSignals(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: ReviewSignalListQueryDto,
  ) {
    return this.service.getByDiagram(auth, diagramId, query);
  }

  @Post(':signalId/ignore')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'signalId', type: String })
  @ApiOperation({ operationId: 'ignoreReviewSignal' })
  @ZodResponse({ status: HttpStatus.OK, type: ReviewSignalResponseDto })
  ignoreReviewSignal(@Auth() auth: AuthContext, @Param('signalId') signalId: string) {
    return this.service.ignore(auth, signalId);
  }

  @Post(':signalId/unignore')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'signalId', type: String })
  @ApiOperation({ operationId: 'unignoreReviewSignal' })
  @ZodResponse({ status: HttpStatus.OK, type: ReviewSignalResponseDto })
  unignoreReviewSignal(@Auth() auth: AuthContext, @Param('signalId') signalId: string) {
    return this.service.unignore(auth, signalId);
  }
}
