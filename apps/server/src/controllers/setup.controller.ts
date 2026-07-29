import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import { AuthType } from '../constants.js';
import { SetupCreateDto, SetupCreateResponseDto, SetupStatusResponseDto } from '../dtos/setup.dto.js';
import { SetupService } from '../services/setup.service.js';
import { respondWithAuthCookies } from '../utils/response.js';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly service: SetupService) {}

  @Get()
  @ApiOperation({ operationId: 'getSetupStatus' })
  @ZodResponse({ type: SetupStatusResponseDto })
  getStatus(): Promise<SetupStatusResponseDto> {
    return this.service.getStatus();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: SetupCreateDto })
  @ApiOperation({ operationId: 'completeSetup' })
  @ZodResponse({ status: HttpStatus.CREATED, type: SetupCreateResponseDto })
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
