import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import {
  ApiKeyCreateDto,
  ApiKeyCreateResponseDto,
  CurrentUserResponseDto,
  LoginCredentialDto,
  LoginResponseDto,
  LogoutResponseDto,
  SignUpDto,
} from '../dtos/auth.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { AuthService } from '../services/auth.service.js';
import { AuthType } from '../constants.js';
import { clearAuthCookies, respondWithAuthCookies } from '../utils/response.js';
import type { AuthContext } from '../database.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get('me')
  @Authenticated()
  @ApiOperation({ operationId: 'getCurrentUser' })
  @ZodResponse({ type: CurrentUserResponseDto })
  getCurrentUser(@Auth() auth: AuthContext): CurrentUserResponseDto {
    return auth.user;
  }

  @Post('sign-up')
  @ApiBody({ type: SignUpDto })
  @ApiOperation({ operationId: 'signUp' })
  @ZodResponse({ status: HttpStatus.CREATED, type: LoginResponseDto })
  async signUp(@Res({ passthrough: true }) res: Response, @Body() dto: SignUpDto): Promise<LoginResponseDto> {
    const body = await this.service.signUp(dto);
    return respondWithAuthCookies(res, body, {
      accessToken: body.accessToken,
      authType: AuthType.Password,
      secure: this.service.getCookieSecureDefault(),
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginCredentialDto })
  @ApiOperation({ operationId: 'login' })
  @ZodResponse({ status: HttpStatus.OK, type: LoginResponseDto })
  async login(@Res({ passthrough: true }) res: Response, @Body() dto: LoginCredentialDto): Promise<LoginResponseDto> {
    const body = await this.service.login(dto);
    return respondWithAuthCookies(res, body, {
      accessToken: body.accessToken,
      authType: AuthType.Password,
      secure: this.service.getCookieSecureDefault(),
    });
  }

  @Post('logout')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'logout' })
  @ZodResponse({ status: HttpStatus.OK, type: LogoutResponseDto })
  async logout(@Res({ passthrough: true }) res: Response, @Auth() auth: AuthContext): Promise<LogoutResponseDto> {
    await this.service.logout(auth);
    return clearAuthCookies(res, { successful: true });
  }

  @Post('api-keys')
  @Authenticated()
  @RequirePermission(Permission.ApiKeyManage)
  @ApiBody({ type: ApiKeyCreateDto })
  @ApiOperation({ operationId: 'createApiKey' })
  @ZodResponse({ status: HttpStatus.CREATED, type: ApiKeyCreateResponseDto })
  createApiKey(@Auth() auth: AuthContext, @Body() dto: ApiKeyCreateDto): Promise<ApiKeyCreateResponseDto> {
    return this.service.createApiKey(auth, dto);
  }
}
