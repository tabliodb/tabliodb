import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServerService } from '../services/server.service.js';

@ApiTags('server')
@Controller('server')
export class AppController {
  constructor(private readonly service: ServerService) {}

  @Get('health')
  getHealth() {
    return this.service.getHealth();
  }
}
