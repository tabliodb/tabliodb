import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { DiagramListQueryDto, DiagramListResponseDto } from '../dtos/diagram.dto.js';
import {
  ProjectArchiveResponseDto,
  ProjectCreateDto,
  ProjectListQueryDto,
  ProjectListResponseDto,
  ProjectMemberCreateDto,
  ProjectMemberDto,
  ProjectMemberListQueryDto,
  ProjectMemberListResponseDto,
  ProjectMemberRemoveResponseDto,
  ProjectMemberUpdateDto,
  ProjectOwnershipTransferDto,
  ProjectResponseDto,
  ProjectUpdateDto,
} from '../dtos/project.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { DiagramService } from '../services/diagram.service.js';
import { ProjectService } from '../services/project.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('projects')
@Controller('projects')
@Authenticated()
export class ProjectController {
  constructor(
    private readonly diagramService: DiagramService,
    private readonly projectService: ProjectService,
  ) {}

  @Get()
  @RequirePermission(Permission.ProjectRead)
  @ApiPaginationQuery()
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @ApiOperation({ operationId: 'getProjects' })
  @ZodResponse({ status: HttpStatus.OK, type: ProjectListResponseDto })
  getProjects(@Auth() auth: AuthContext, @Query() query: ProjectListQueryDto) {
    return this.projectService.getAll(auth, query);
  }

  @Post()
  @RateLimit(RateLimitPreset.ProjectWrite)
  @RequirePermission(Permission.ProjectCreate, { key: 'organizationId', source: 'body', type: 'organization' })
  @ApiBody({ type: ProjectCreateDto })
  @ApiOperation({ operationId: 'createProject' })
  @ZodResponse({ status: HttpStatus.CREATED, type: ProjectResponseDto })
  createProject(@Auth() auth: AuthContext, @Body() dto: ProjectCreateDto) {
    return this.projectService.create(auth, dto);
  }

  @Patch(':projectId')
  @RateLimit(RateLimitPreset.ProjectWrite)
  @RequirePermission(Permission.ProjectUpdate, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: ProjectUpdateDto })
  @ApiOperation({ operationId: 'updateProject' })
  @ZodResponse({ status: HttpStatus.OK, type: ProjectResponseDto })
  updateProject(@Auth() auth: AuthContext, @Param('projectId') projectId: string, @Body() dto: ProjectUpdateDto) {
    return this.projectService.update(auth, projectId, dto);
  }

  @Delete(':projectId')
  @RateLimit(RateLimitPreset.ProjectWrite)
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ProjectDelete, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiOperation({ operationId: 'archiveProject' })
  @ZodResponse({ status: HttpStatus.OK, type: ProjectArchiveResponseDto })
  archiveProject(@Auth() auth: AuthContext, @Param('projectId') projectId: string): Promise<ProjectArchiveResponseDto> {
    return this.projectService.archive(auth, projectId);
  }

  @Get(':projectId/members')
  @RequirePermission(Permission.ProjectMemberManage, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getProjectMembers' })
  @ZodResponse({ status: HttpStatus.OK, type: ProjectMemberListResponseDto })
  getProjectMembers(
    @Auth() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Query() query: ProjectMemberListQueryDto,
  ): Promise<ProjectMemberListResponseDto> {
    return this.projectService.getMembers(auth, projectId, query);
  }

  @Post(':projectId/members')
  @RateLimit(RateLimitPreset.ProjectWrite)
  @RequirePermission(Permission.ProjectMemberManage, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: ProjectMemberCreateDto })
  @ApiOperation({ operationId: 'addProjectMember' })
  @ZodResponse({ status: HttpStatus.CREATED, type: ProjectMemberDto })
  addProjectMember(
    @Auth() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Body() dto: ProjectMemberCreateDto,
  ): Promise<ProjectMemberDto> {
    return this.projectService.addMember(auth, projectId, dto);
  }

  @Post(':projectId/ownership/transfer')
  @RateLimit(RateLimitPreset.ProjectWrite)
  @RequirePermission(Permission.ProjectMemberManage, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: ProjectOwnershipTransferDto })
  @ApiOperation({ operationId: 'transferProjectOwnership' })
  @ZodResponse({ status: HttpStatus.OK, type: ProjectMemberDto })
  transferProjectOwnership(
    @Auth() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Body() dto: ProjectOwnershipTransferDto,
  ): Promise<ProjectMemberDto> {
    return this.projectService.transferOwnership(auth, projectId, dto);
  }

  @Patch(':projectId/members/:userId')
  @RateLimit(RateLimitPreset.ProjectWrite)
  @RequirePermission(Permission.ProjectMemberManage, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: ProjectMemberUpdateDto })
  @ApiOperation({ operationId: 'updateProjectMember' })
  @ZodResponse({ status: HttpStatus.OK, type: ProjectMemberDto })
  updateProjectMember(
    @Auth() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: ProjectMemberUpdateDto,
  ): Promise<ProjectMemberDto> {
    return this.projectService.updateMember(auth, projectId, userId, dto);
  }

  @Delete(':projectId/members/:userId')
  @RateLimit(RateLimitPreset.ProjectWrite)
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ProjectMemberManage, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiOperation({ operationId: 'removeProjectMember' })
  @ZodResponse({ status: HttpStatus.OK, type: ProjectMemberRemoveResponseDto })
  removeProjectMember(
    @Auth() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ): Promise<ProjectMemberRemoveResponseDto> {
    return this.projectService.removeMember(auth, projectId, userId);
  }

  @Get(':projectId/diagrams')
  @RequirePermission(Permission.DiagramRead, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getProjectDiagrams' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramListResponseDto })
  getProjectDiagrams(
    @Auth() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Query() query: DiagramListQueryDto,
  ) {
    return this.diagramService.getByProject(auth, projectId, query);
  }
}
