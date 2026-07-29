import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../database.js';
import { DiagramCreateDto } from '../dtos/diagram.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { DiagramService } from '../services/diagram.service.js';

@ApiTags('diagrams')
@Controller('diagrams')
@Authenticated()
export class DiagramController {
  constructor(private readonly service: DiagramService) {}

  @Post()
  createDiagram(@Auth() auth: AuthContext, @Body() dto: DiagramCreateDto) {
    return this.service.create(auth, dto);
  }
}
