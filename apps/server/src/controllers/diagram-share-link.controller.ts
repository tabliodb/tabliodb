import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  DiagramShareLinkCreateDto,
  DiagramShareLinkCreateResponseDto,
  DiagramShareLinkListQueryDto,
  DiagramShareLinkListResponseDto,
  DiagramShareLinkRevokeResponseDto,
} from '../dtos/share-link.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { DiagramShareLinkService } from '../services/diagram-share-link.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('diagram-share-links')
@Controller('diagrams/:diagramId/share-links')
@Authenticated()
export class DiagramShareLinkController {
  constructor(private readonly service: DiagramShareLinkService) {}

  @Get()
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getDiagramShareLinks' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramShareLinkListResponseDto })
  getDiagramShareLinks(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: DiagramShareLinkListQueryDto,
  ) {
    return this.service.list(auth, diagramId, query);
  }

  @Post()
  @RequirePermission(Permission.DiagramUpdate, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiBody({ type: DiagramShareLinkCreateDto })
  @ApiOperation({ operationId: 'createDiagramShareLink' })
  @ZodResponse({ status: HttpStatus.CREATED, type: DiagramShareLinkCreateResponseDto })
  createDiagramShareLink(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Body() dto: DiagramShareLinkCreateDto,
  ) {
    return this.service.create(auth, diagramId, dto);
  }

  @Delete(':shareLinkId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.DiagramUpdate, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiParam({ name: 'shareLinkId', type: String })
  @ApiOperation({ operationId: 'revokeDiagramShareLink' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramShareLinkRevokeResponseDto })
  revokeDiagramShareLink(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Param('shareLinkId') shareLinkId: string,
  ) {
    return this.service.revoke(auth, diagramId, shareLinkId);
  }
}
