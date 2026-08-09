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
} from '../dtos/setup.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
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
