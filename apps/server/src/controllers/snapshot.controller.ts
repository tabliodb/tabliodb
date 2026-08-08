import { Body, Controller, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  SnapshotCreateDto,
  SnapshotDiffResponseDto,
  SnapshotListQueryDto,
  SnapshotListResponseDto,
  SnapshotResponseDto,
} from '../dtos/snapshot.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { SnapshotService } from '../services/snapshot.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('snapshots')
@Controller('snapshots')
@Authenticated()
export class SnapshotController {
  constructor(private readonly service: SnapshotService) {}

  @Post()
  @RequirePermission(Permission.SnapshotCreate, { key: 'diagramId', source: 'body', type: 'diagram' })
  @ApiBody({ type: SnapshotCreateDto })
  @ApiOperation({ operationId: 'createSnapshot' })
  @ZodResponse({ status: HttpStatus.CREATED, type: SnapshotResponseDto })
  createSnapshot(@Auth() auth: AuthContext, @Body() dto: SnapshotCreateDto) {
    return this.service.create(auth, dto);
  }

  @Get('diagram/:diagramId')
  @RequirePermission(Permission.SnapshotRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getDiagramSnapshots' })
  @ZodResponse({ status: HttpStatus.OK, type: SnapshotListResponseDto })
  getDiagramSnapshots(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: SnapshotListQueryDto,
  ) {
    return this.service.getByDiagram(auth, diagramId, query);
  }

  @Get(':fromSnapshotId/diff/:toSnapshotId')
  @ApiParam({ name: 'fromSnapshotId', type: String })
  @ApiParam({ name: 'toSnapshotId', type: String })
  @ApiOperation({ operationId: 'getSnapshotDiff' })
  @ZodResponse({ status: HttpStatus.OK, type: SnapshotDiffResponseDto })
  getSnapshotDiff(
    @Auth() auth: AuthContext,
    @Param('fromSnapshotId') fromSnapshotId: string,
    @Param('toSnapshotId') toSnapshotId: string,
  ) {
    // Permission berbasis diagram dihitung di service karena route ini hanya membawa snapshotId.
    return this.service.getDiff(auth, fromSnapshotId, toSnapshotId);
  }

  @Post(':snapshotId/restore')
  @ApiParam({ name: 'snapshotId', type: String })
  @ApiOperation({ operationId: 'restoreSnapshot' })
  @ZodResponse({ status: HttpStatus.CREATED, type: SnapshotResponseDto })
  restoreSnapshot(@Auth() auth: AuthContext, @Param('snapshotId') snapshotId: string) {
    // Restore tidak mengubah snapshot lama; service membuat checkpoint baru yang menunjuk ke restoredFromSnapshotId.
    return this.service.restore(auth, snapshotId);
  }
}
