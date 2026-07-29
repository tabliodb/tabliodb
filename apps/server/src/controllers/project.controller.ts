import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../database.js';
import { ProjectCreateDto } from '../dtos/project.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { DiagramService } from '../services/diagram.service.js';
import { ProjectService } from '../services/project.service.js';

@ApiTags('projects')
@Controller('projects')
@Authenticated()
export class ProjectController {
  constructor(
    private readonly diagramService: DiagramService,
    private readonly projectService: ProjectService,
  ) {}

  @Get()
  getProjects(@Auth() auth: AuthContext) {
    return this.projectService.getAll(auth);
  }

  @Post()
  createProject(@Auth() auth: AuthContext, @Body() dto: ProjectCreateDto) {
    return this.projectService.create(auth, dto);
  }

  @Get(':projectId/diagrams')
  getProjectDiagrams(@Auth() auth: AuthContext, @Param('projectId') projectId: string) {
    return this.diagramService.getByProject(auth, projectId);
  }
}
