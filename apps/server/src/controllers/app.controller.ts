import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { ServerHealthResponseDto, ServerLivenessResponseDto, ServerMetricsResponseDto } from '../dtos/server.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { ServerService } from '../services/server.service.js';

@ApiTags('server')
@Controller('server')
export class AppController {
  constructor(private readonly service: ServerService) {}

  @Get('health')
  @ApiOperation({ operationId: 'getServerHealth' })
  @ZodResponse({ status: HttpStatus.OK, type: ServerHealthResponseDto })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const health = await this.service.getReadiness();

    // Kept as a compatibility alias for older Docker healthchecks while /server/ready becomes the explicit readiness probe.
    response.status(health.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return health;
  }

  @Get('live')
  @ApiOperation({ operationId: 'getServerLiveness' })
  @ZodResponse({ status: HttpStatus.OK, type: ServerLivenessResponseDto })
  getLiveness() {
    return this.service.getLiveness();
  }

  @Get('ready')
  @ApiOperation({ operationId: 'getServerReadiness' })
  @ZodResponse({ status: HttpStatus.OK, type: ServerHealthResponseDto })
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const health = await this.service.getReadiness();

    // Readiness reports dependency status; 503 tells load balancers to stop routing traffic without restarting the process.
    response.status(health.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return health;
  }

  @Get('metrics')
  @Authenticated()
  @ApiOperation({ operationId: 'getServerMetrics' })
  @ZodResponse({ status: HttpStatus.OK, type: ServerMetricsResponseDto })
  getMetrics(@Auth() auth: AuthContext) {
    return this.service.getMetrics(auth);
  }
}
