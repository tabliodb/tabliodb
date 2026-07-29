import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../database.js';
import { SnapshotCreateDto, SnapshotListQueryDto } from '../dtos/snapshot.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { SnapshotService } from '../services/snapshot.service.js';

@ApiTags('snapshots')
@Controller('snapshots')
@Authenticated()
export class SnapshotController {
  constructor(private readonly service: SnapshotService) {}

  @Post()
  createSnapshot(@Auth() auth: AuthContext, @Body() dto: SnapshotCreateDto) {
    return this.service.create(auth, dto);
  }

  @Get('diagram/:diagramId')
  getDiagramSnapshots(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: SnapshotListQueryDto,
  ) {
    return this.service.getByDiagram(auth, diagramId, query);
  }
}
