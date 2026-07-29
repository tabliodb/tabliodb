import { Body, Controller, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  SnapshotCreateDto,
  SnapshotListQueryDto,
  SnapshotListResponseDto,
  SnapshotResponseDto,
} from '../dtos/snapshot.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { SnapshotService } from '../services/snapshot.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('snapshots')
@Controller('snapshots')
@Authenticated()
export class SnapshotController {
  constructor(private readonly service: SnapshotService) {}

  @Post()
  @ApiBody({ type: SnapshotCreateDto })
  @ApiOperation({ operationId: 'createSnapshot' })
  @ZodResponse({ status: HttpStatus.CREATED, type: SnapshotResponseDto })
  createSnapshot(@Auth() auth: AuthContext, @Body() dto: SnapshotCreateDto) {
    return this.service.create(auth, dto);
  }

  @Get('diagram/:diagramId')
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getDiagramSnapshots' })
  @ZodResponse({ type: SnapshotListResponseDto })
  getDiagramSnapshots(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: SnapshotListQueryDto,
  ) {
    return this.service.getByDiagram(auth, diagramId, query);
  }
}
