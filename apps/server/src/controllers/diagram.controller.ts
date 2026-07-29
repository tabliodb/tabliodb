import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { DiagramCreateDto, DiagramResponseDto } from '../dtos/diagram.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { DiagramService } from '../services/diagram.service.js';

@ApiTags('diagrams')
@Controller('diagrams')
@Authenticated()
export class DiagramController {
  constructor(private readonly service: DiagramService) {}

  @Post()
  @RequirePermission(Permission.DiagramCreate, { key: 'projectId', source: 'body', type: 'project' })
  @ApiBody({ type: DiagramCreateDto })
  @ApiOperation({ operationId: 'createDiagram' })
  @ZodResponse({ status: HttpStatus.CREATED, type: DiagramResponseDto })
  createDiagram(@Auth() auth: AuthContext, @Body() dto: DiagramCreateDto) {
    return this.service.create(auth, dto);
  }
}
