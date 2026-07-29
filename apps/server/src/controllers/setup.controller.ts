import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthType } from '../constants.js';
import { SetupCreateDto, SetupCreateResponseDto, SetupStatusResponseDto } from '../dtos/setup.dto.js';
import { SetupService } from '../services/setup.service.js';
import { respondWithAuthCookies } from '../utils/response.js';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly service: SetupService) {}

  @Get()
  getStatus(): Promise<SetupStatusResponseDto> {
    return this.service.getStatus();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async complete(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: SetupCreateDto,
  ): Promise<SetupCreateResponseDto> {
    const body = await this.service.complete(dto);
    return respondWithAuthCookies(res, body, {
      accessToken: body.accessToken,
      authType: AuthType.Password,
      secure: this.service.getCookieSecureDefault(),
    });
  }
}
