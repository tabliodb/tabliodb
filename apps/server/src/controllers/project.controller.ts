import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { DiagramListQueryDto, DiagramListResponseDto } from '../dtos/diagram.dto.js';
import {
  ProjectArchiveResponseDto,
  ProjectCreateDto,
  ProjectListQueryDto,
  ProjectListResponseDto,
  ProjectResponseDto,
  ProjectUpdateDto,
} from '../dtos/project.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
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
  @ApiOperation({ operationId: 'getProjects' })
  @ZodResponse({ type: ProjectListResponseDto })
  getProjects(@Auth() auth: AuthContext, @Query() query: ProjectListQueryDto) {
    return this.projectService.getAll(auth, query);
  }

  @Post()
  @RequirePermission(Permission.ProjectCreate)
  @ApiBody({ type: ProjectCreateDto })
  @ApiOperation({ operationId: 'createProject' })
  @ZodResponse({ status: HttpStatus.CREATED, type: ProjectResponseDto })
  createProject(@Auth() auth: AuthContext, @Body() dto: ProjectCreateDto) {
    return this.projectService.create(auth, dto);
  }

  @Patch(':projectId')
  @RequirePermission(Permission.ProjectUpdate, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: ProjectUpdateDto })
  @ApiOperation({ operationId: 'updateProject' })
  @ZodResponse({ type: ProjectResponseDto })
  updateProject(@Auth() auth: AuthContext, @Param('projectId') projectId: string, @Body() dto: ProjectUpdateDto) {
    return this.projectService.update(auth, projectId, dto);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ProjectDelete, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiOperation({ operationId: 'archiveProject' })
  @ZodResponse({ status: HttpStatus.OK, type: ProjectArchiveResponseDto })
  archiveProject(@Auth() auth: AuthContext, @Param('projectId') projectId: string): Promise<ProjectArchiveResponseDto> {
    return this.projectService.archive(auth, projectId);
  }

  @Get(':projectId/diagrams')
  @RequirePermission(Permission.DiagramRead, { key: 'projectId', source: 'param', type: 'project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getProjectDiagrams' })
  @ZodResponse({ type: DiagramListResponseDto })
  getProjectDiagrams(
    @Auth() auth: AuthContext,
    @Param('projectId') projectId: string,
    @Query() query: DiagramListQueryDto,
  ) {
    return this.diagramService.getByProject(auth, projectId, query);
  }
}
