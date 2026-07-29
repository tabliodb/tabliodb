import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ServerHealthResponseDto } from '../dtos/server.dto.js';
import { ServerService } from '../services/server.service.js';

@ApiTags('server')
@Controller('server')
export class AppController {
  constructor(private readonly service: ServerService) {}

  @Get('health')
  @ApiOperation({ operationId: 'getServerHealth' })
  @ZodResponse({ type: ServerHealthResponseDto })
  getHealth() {
    return this.service.getHealth();
  }
}
