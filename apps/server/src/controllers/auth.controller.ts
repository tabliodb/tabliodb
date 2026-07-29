import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
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
  getCurrentUser(@Auth() auth: AuthContext): CurrentUserResponseDto {
    return auth.user;
  }

  @Post('sign-up')
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
  async logout(@Res({ passthrough: true }) res: Response, @Auth() auth: AuthContext): Promise<LogoutResponseDto> {
    await this.service.logout(auth);
    return clearAuthCookies(res, { successful: true });
  }

  @Post('api-keys')
  @Authenticated()
  createApiKey(@Auth() auth: AuthContext, @Body() dto: ApiKeyCreateDto): Promise<ApiKeyCreateResponseDto> {
    return this.service.createApiKey(auth, dto);
  }
}
