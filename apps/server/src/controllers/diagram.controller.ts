import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  DiagramCreateDto,
  DiagramEffectiveAccessListResponseDto,
  DiagramExportQueryDto,
  DiagramExportResponseDto,
  DiagramImportDto,
  DiagramImportResponseDto,
  DiagramListQueryDto,
  DiagramListResponseDto,
  DiagramMemberCreateDto,
  DiagramMemberDto,
  DiagramMemberListQueryDto,
  DiagramMemberListResponseDto,
  DiagramMemberRemoveResponseDto,
  DiagramMemberUpdateDto,
  DiagramResponseDto,
  DiagramUpdateDto,
  WorkspaceDiagramCreateDto,
} from '../dtos/diagram.dto.js';
import {
  DiagramReviewActionCreateDto,
  DiagramReviewEventListQueryDto,
  DiagramReviewEventListResponseDto,
  DiagramReviewSummaryDto,
} from '../dtos/diagram-review.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { DiagramService } from '../services/diagram.service.js';
import { DiagramReviewService } from '../services/diagram-review.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('diagrams')
@Controller('diagrams')
@Authenticated()
export class DiagramController {
  constructor(
    private readonly service: DiagramService,
    private readonly diagramReviewService: DiagramReviewService,
  ) {}

  @Post()
  @RateLimit(RateLimitPreset.DiagramWrite)
  @RequirePermission(Permission.DiagramCreate, { key: 'organizationId', source: 'body', type: 'organization' })
  @ApiBody({ type: DiagramCreateDto })
  @ApiOperation({ operationId: 'createDiagram' })
  @ZodResponse({ status: HttpStatus.CREATED, type: DiagramResponseDto })
  createDiagram(@Auth() auth: AuthContext, @Body() dto: DiagramCreateDto) {
    return this.service.create(auth, dto);
  }

  @Post('workspace/:organizationId')
  @RateLimit(RateLimitPreset.DiagramWrite)
  @RequirePermission(Permission.DiagramCreate, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiBody({ type: WorkspaceDiagramCreateDto })
  @ApiOperation({ operationId: 'createWorkspaceDiagram' })
  @ZodResponse({ status: HttpStatus.CREATED, type: DiagramResponseDto })
  createWorkspaceDiagram(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Body() dto: WorkspaceDiagramCreateDto,
  ) {
    return this.service.createInOrganization(auth, organizationId, dto);
  }

  @Get('workspace/:organizationId')
  @RequirePermission(Permission.OrganizationRead, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getWorkspaceDiagrams' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramListResponseDto })
  getWorkspaceDiagrams(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Query() query: DiagramListQueryDto,
  ) {
    return this.service.getByOrganization(auth, organizationId, query);
  }

  @Get(':diagramId/members')
  @RequirePermission(Permission.DiagramMemberManage, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getDiagramMembers' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramMemberListResponseDto })
  getDiagramMembers(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: DiagramMemberListQueryDto,
  ): Promise<DiagramMemberListResponseDto> {
    return this.service.getMembers(auth, diagramId, query);
  }

  @Get(':diagramId/effective-access')
  @RequirePermission(Permission.DiagramMemberManage, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getDiagramEffectiveAccess' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramEffectiveAccessListResponseDto })
  getDiagramEffectiveAccess(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: DiagramMemberListQueryDto,
  ): Promise<DiagramEffectiveAccessListResponseDto> {
    return this.service.getEffectiveAccess(auth, diagramId, query);
  }

  @Post(':diagramId/members')
  @RateLimit(RateLimitPreset.DiagramWrite)
  @RequirePermission(Permission.DiagramMemberManage, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiBody({ type: DiagramMemberCreateDto })
  @ApiOperation({ operationId: 'addDiagramMember' })
  @ZodResponse({ status: HttpStatus.CREATED, type: DiagramMemberDto })
  addDiagramMember(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Body() dto: DiagramMemberCreateDto,
  ): Promise<DiagramMemberDto> {
    return this.service.addMember(auth, diagramId, dto);
  }

  @Patch(':diagramId/members/:userId')
  @RateLimit(RateLimitPreset.DiagramWrite)
  @RequirePermission(Permission.DiagramMemberManage, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: DiagramMemberUpdateDto })
  @ApiOperation({ operationId: 'updateDiagramMember' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramMemberDto })
  updateDiagramMember(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Param('userId') userId: string,
    @Body() dto: DiagramMemberUpdateDto,
  ): Promise<DiagramMemberDto> {
    return this.service.updateMember(auth, diagramId, userId, dto);
  }

  @Delete(':diagramId/members/:userId')
  @RateLimit(RateLimitPreset.DiagramWrite)
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.DiagramMemberManage, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiOperation({ operationId: 'removeDiagramMember' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramMemberRemoveResponseDto })
  removeDiagramMember(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Param('userId') userId: string,
  ): Promise<DiagramMemberRemoveResponseDto> {
    return this.service.removeMember(auth, diagramId, userId);
  }

  @Patch(':diagramId')
  @RateLimit(RateLimitPreset.DiagramWrite)
  @RequirePermission(Permission.DiagramUpdate, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiBody({ type: DiagramUpdateDto })
  @ApiOperation({ operationId: 'updateDiagram' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramResponseDto })
  updateDiagram(@Auth() auth: AuthContext, @Param('diagramId') diagramId: string, @Body() dto: DiagramUpdateDto) {
    return this.service.update(auth, diagramId, dto);
  }

  @Get(':diagramId/export')
  @RateLimit(RateLimitPreset.DiagramExport)
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiQuery({ enum: ['tabliodb_json', 'sql', 'markdown', 'svg'], name: 'format', required: false })
  @ApiQuery({ enum: ['postgresql', 'mysql', 'sqlite', 'mariadb', 'sqlserver'], name: 'dialect', required: false })
  @ApiQuery({ name: 'includeComments', required: false, type: Boolean })
  @ApiOperation({ operationId: 'exportDiagram' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramExportResponseDto })
  exportDiagram(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: DiagramExportQueryDto,
  ) {
    return this.service.exportDiagram(auth, diagramId, query);
  }

  @Post(':diagramId/import')
  @RateLimit(RateLimitPreset.DiagramImport)
  @RequirePermission(Permission.DiagramUpdate, { key: 'diagramId', source: 'param', type: 'diagram' })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'diagramId', type: String })
  @ApiBody({ type: DiagramImportDto })
  @ApiOperation({ operationId: 'importDiagram' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramImportResponseDto })
  importDiagram(@Auth() auth: AuthContext, @Param('diagramId') diagramId: string, @Body() dto: DiagramImportDto) {
    return this.service.importDiagram(auth, diagramId, dto);
  }

  @Get(':diagramId/review')
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiOperation({ operationId: 'getDiagramReviewSummary' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramReviewSummaryDto })
  getDiagramReviewSummary(@Auth() auth: AuthContext, @Param('diagramId') diagramId: string) {
    return this.diagramReviewService.getSummary(auth, diagramId);
  }

  @Get(':diagramId/review/events')
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getDiagramReviewEvents' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramReviewEventListResponseDto })
  getDiagramReviewEvents(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: DiagramReviewEventListQueryDto,
  ) {
    return this.diagramReviewService.listEvents(auth, diagramId, query);
  }

  @Post(':diagramId/review/actions')
  @RateLimit(RateLimitPreset.DiagramReviewAction)
  @RequirePermission(Permission.DiagramComment, { key: 'diagramId', source: 'param', type: 'diagram' })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'diagramId', type: String })
  @ApiBody({ type: DiagramReviewActionCreateDto })
  @ApiOperation({ operationId: 'createDiagramReviewAction' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramReviewSummaryDto })
  createDiagramReviewAction(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Body() dto: DiagramReviewActionCreateDto,
  ) {
    return this.diagramReviewService.createAction(auth, diagramId, dto);
  }
}
