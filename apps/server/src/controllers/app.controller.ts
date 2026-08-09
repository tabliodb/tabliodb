import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import { ServerHealthResponseDto, ServerMetricsResponseDto } from '../dtos/server.dto.js';
import { ServerService } from '../services/server.service.js';

@ApiTags('server')
@Controller('server')
export class AppController {
  constructor(private readonly service: ServerService) {}

  @Get('health')
  @ApiOperation({ operationId: 'getServerHealth' })
  @ZodResponse({ status: HttpStatus.OK, type: ServerHealthResponseDto })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const health = await this.service.getHealth();

    // Docker healthcheck membaca HTTP status; 503 membuat orchestrator tahu app belum siap menerima traffic.
    response.status(health.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return health;
  }

  @Get('metrics')
  @ApiOperation({ operationId: 'getServerMetrics' })
  @ZodResponse({ status: HttpStatus.OK, type: ServerMetricsResponseDto })
  getMetrics() {
    return this.service.getMetrics();
  }
}
