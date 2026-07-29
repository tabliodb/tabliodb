import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { DiagramCreateDto, DiagramResponseDto } from '../dtos/diagram.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { DiagramService } from '../services/diagram.service.js';

@ApiTags('diagrams')
@Controller('diagrams')
@Authenticated()
export class DiagramController {
  constructor(private readonly service: DiagramService) {}

  @Post()
  @ApiBody({ type: DiagramCreateDto })
  @ApiOperation({ operationId: 'createDiagram' })
  @ZodResponse({ status: HttpStatus.CREATED, type: DiagramResponseDto })
  createDiagram(@Auth() auth: AuthContext, @Body() dto: DiagramCreateDto) {
    return this.service.create(auth, dto);
  }
}
