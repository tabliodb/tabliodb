import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { AuthType } from '../constants.js';
import {
  InstanceAuthSettingsDto,
  InstanceAuthSettingsUpdateDto,
  OidcProviderSettingsDto,
  OidcProviderSettingsUpdateDto,
  SetupCreateDto,
  SetupCreateResponseDto,
  SetupStatusResponseDto,
  SmtpSettingsDto,
  SmtpSettingsUpdateDto,
} from '../dtos/setup.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { SetupService } from '../services/setup.service.js';
import { respondWithAuthCookies } from '../utils/response.js';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly service: SetupService) {}

  @Get()
  @ApiOperation({ operationId: 'getSetupStatus' })
  @ZodResponse({ status: HttpStatus.OK, type: SetupStatusResponseDto })
  getStatus(): Promise<SetupStatusResponseDto> {
    return this.service.getStatus();
  }

  @Get('auth-settings')
  @Authenticated()
  @RequirePermission(Permission.OrganizationManage)
  @ApiOperation({ operationId: 'getInstanceAuthSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: InstanceAuthSettingsDto })
  getAuthSettings(@Auth() auth: AuthContext): Promise<InstanceAuthSettingsDto> {
    return this.service.getAuthSettings(auth);
  }

  @Post('auth-settings')
  @RateLimit(RateLimitPreset.InstanceSettingsWrite)
  @Authenticated()
  @RequirePermission(Permission.OrganizationManage)
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: InstanceAuthSettingsUpdateDto })
  @ApiOperation({ operationId: 'updateInstanceAuthSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: InstanceAuthSettingsDto })
  updateAuthSettings(
    @Auth() auth: AuthContext,
    @Body() dto: InstanceAuthSettingsUpdateDto,
  ): Promise<InstanceAuthSettingsDto> {
    return this.service.updateAuthSettings(auth, dto);
  }

  @Get('oidc-provider')
  @Authenticated()
  @RequirePermission(Permission.OrganizationManage)
  @ApiOperation({ operationId: 'getOidcProviderSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: OidcProviderSettingsDto })
  getOidcProviderSettings(@Auth() auth: AuthContext): Promise<OidcProviderSettingsDto> {
    return this.service.getOidcProviderSettings(auth);
  }

  @Post('oidc-provider')
  @RateLimit(RateLimitPreset.InstanceSettingsWrite)
  @Authenticated()
  @RequirePermission(Permission.OrganizationManage)
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: OidcProviderSettingsUpdateDto })
  @ApiOperation({ operationId: 'updateOidcProviderSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: OidcProviderSettingsDto })
  updateOidcProviderSettings(
    @Auth() auth: AuthContext,
    @Body() dto: OidcProviderSettingsUpdateDto,
  ): Promise<OidcProviderSettingsDto> {
    return this.service.updateOidcProviderSettings(auth, dto);
  }

  @Get('smtp-settings')
  @Authenticated()
  @RequirePermission(Permission.OrganizationManage)
  @ApiOperation({ operationId: 'getSmtpSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: SmtpSettingsDto })
  getSmtpSettings(@Auth() auth: AuthContext): Promise<SmtpSettingsDto> {
    return this.service.getSmtpSettings(auth);
  }

  @Post('smtp-settings')
  @RateLimit(RateLimitPreset.InstanceSettingsWrite)
  @Authenticated()
  @RequirePermission(Permission.OrganizationManage)
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: SmtpSettingsUpdateDto })
  @ApiOperation({ operationId: 'updateSmtpSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: SmtpSettingsDto })
  updateSmtpSettings(@Auth() auth: AuthContext, @Body() dto: SmtpSettingsUpdateDto): Promise<SmtpSettingsDto> {
    return this.service.updateSmtpSettings(auth, dto);
  }

  @Post()
  @RateLimit(RateLimitPreset.SetupComplete)
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
