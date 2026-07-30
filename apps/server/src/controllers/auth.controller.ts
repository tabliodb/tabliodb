import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import {
  ApiKeyCreateDto,
  ApiKeyCreateResponseDto,
  CurrentUserProfileUpdateDto,
  CurrentUserResponseDto,
  LoginCredentialDto,
  LoginResponseDto,
  LogoutResponseDto,
  PasswordResetConfirmDto,
  PasswordResetConfirmResponseDto,
  PasswordResetRequestDto,
  PasswordResetRequestResponseDto,
  SignUpDto,
} from '../dtos/auth.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { AuthService } from '../services/auth.service.js';
import { AVATAR_MAX_BYTES, type UploadedAvatarFile } from '../services/file.service.js';
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

  @Patch('me/profile')
  @Authenticated()
  @ApiBody({ type: CurrentUserProfileUpdateDto })
  @ApiOperation({ operationId: 'updateCurrentUserProfile' })
  @ZodResponse({ type: CurrentUserResponseDto })
  updateCurrentUserProfile(
    @Auth() auth: AuthContext,
    @Body() dto: CurrentUserProfileUpdateDto,
  ): Promise<CurrentUserResponseDto> {
    return this.service.updateProfile(auth, dto);
  }

  @Post('me/avatar')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      properties: {
        file: {
          format: 'binary',
          type: 'string',
        },
      },
      required: ['file'],
      type: 'object',
    },
  })
  @ApiOperation({ operationId: 'uploadCurrentUserAvatar' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserResponseDto })
  uploadCurrentUserAvatar(
    @Auth() auth: AuthContext,
    @UploadedFile() file: UploadedAvatarFile | undefined,
  ): Promise<CurrentUserResponseDto> {
    return this.service.uploadAvatar(auth, file);
  }

  @Delete('me/avatar')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'deleteCurrentUserAvatar' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserResponseDto })
  deleteCurrentUserAvatar(@Auth() auth: AuthContext): Promise<CurrentUserResponseDto> {
    return this.service.deleteAvatar(auth);
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

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: PasswordResetRequestDto })
  @ApiOperation({ operationId: 'requestPasswordReset' })
  @ZodResponse({ status: HttpStatus.OK, type: PasswordResetRequestResponseDto })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<PasswordResetRequestResponseDto> {
    return this.service.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: PasswordResetConfirmDto })
  @ApiOperation({ operationId: 'confirmPasswordReset' })
  @ZodResponse({ status: HttpStatus.OK, type: PasswordResetConfirmResponseDto })
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<PasswordResetConfirmResponseDto> {
    return this.service.confirmPasswordReset(dto);
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
