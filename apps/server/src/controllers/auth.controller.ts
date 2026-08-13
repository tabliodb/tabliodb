import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import {
  ApiKeyCreateDto,
  ApiKeyCreateResponseDto,
  ApiKeyListQueryDto,
  ApiKeyListResponseDto,
  ApiKeyRevokeResponseDto,
  CurrentUserEditorPreferenceDto,
  CurrentUserEditorPreferenceUpdateDto,
  CurrentUserPasswordUpdateDto,
  CurrentUserProfileUpdateDto,
  CurrentUserResponseDto,
  CurrentUserTemporaryPasswordUpdateDto,
  LoginCredentialDto,
  LoginResponseDto,
  LogoutResponseDto,
  OidcLoginProviderDto,
  OidcLoginStartDto,
  OidcLoginStartResponseDto,
  PasswordResetConfirmDto,
  PasswordResetConfirmResponseDto,
  PasswordResetRequestDto,
  PasswordResetRequestResponseDto,
  SignUpDto,
} from '../dtos/auth.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { AuthService } from '../services/auth.service.js';
import { AVATAR_MAX_BYTES, type UploadedAvatarFile } from '../services/file.service.js';
import { UserPreferenceService } from '../services/user-preference.service.js';
import { AuthType } from '../constants.js';
import { clearAuthCookies, respondWithAuthCookies, setCsrfCookie } from '../utils/response.js';
import type { AuthContext } from '../database.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly userPreferenceService: UserPreferenceService,
  ) {}

  @Get('me')
  @Authenticated({ allowTemporaryPassword: true })
  @ApiOperation({ operationId: 'getCurrentUser' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserResponseDto })
  getCurrentUser(@Res({ passthrough: true }) res: Response, @Auth() auth: AuthContext): CurrentUserResponseDto {
    if (auth.session?.source === 'cookie') {
      // Existing cookie sessions from older dev builds receive a CSRF token during the normal bootstrap /auth/me probe.
      setCsrfCookie(res, { secure: this.service.getCookieSecureDefault() });
    }

    return auth.user;
  }

  @Patch('me/profile')
  @RateLimit(RateLimitPreset.CurrentUserWrite)
  @Authenticated()
  @ApiBody({ type: CurrentUserProfileUpdateDto })
  @ApiOperation({ operationId: 'updateCurrentUserProfile' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserResponseDto })
  updateCurrentUserProfile(
    @Auth() auth: AuthContext,
    @Body() dto: CurrentUserProfileUpdateDto,
  ): Promise<CurrentUserResponseDto> {
    return this.service.updateProfile(auth, dto);
  }

  @Patch('me/password')
  @RateLimit(RateLimitPreset.CurrentPasswordChange)
  @Authenticated()
  @ApiBody({ type: CurrentUserPasswordUpdateDto })
  @ApiOperation({ operationId: 'updateCurrentUserPassword' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserResponseDto })
  updateCurrentUserPassword(
    @Auth() auth: AuthContext,
    @Body() dto: CurrentUserPasswordUpdateDto,
  ): Promise<CurrentUserResponseDto> {
    return this.service.updatePassword(auth, dto);
  }

  @Patch('me/temporary-password')
  @RateLimit(RateLimitPreset.CurrentPasswordChange)
  @Authenticated({ allowTemporaryPassword: true })
  @ApiBody({ type: CurrentUserTemporaryPasswordUpdateDto })
  @ApiOperation({ operationId: 'updateCurrentUserTemporaryPassword' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserResponseDto })
  updateCurrentUserTemporaryPassword(
    @Auth() auth: AuthContext,
    @Body() dto: CurrentUserTemporaryPasswordUpdateDto,
  ): Promise<CurrentUserResponseDto> {
    return this.service.updateTemporaryPassword(auth, dto);
  }

  @Get('me/editor-preference')
  @Authenticated()
  @ApiOperation({ operationId: 'getCurrentUserEditorPreference' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserEditorPreferenceDto })
  getCurrentUserEditorPreference(@Auth() auth: AuthContext): Promise<CurrentUserEditorPreferenceDto> {
    return this.userPreferenceService.getEditorPreference(auth);
  }

  @Patch('me/editor-preference')
  @RateLimit(RateLimitPreset.EditorPreferenceWrite)
  @Authenticated()
  @ApiBody({ type: CurrentUserEditorPreferenceUpdateDto })
  @ApiOperation({ operationId: 'updateCurrentUserEditorPreference' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserEditorPreferenceDto })
  updateCurrentUserEditorPreference(
    @Auth() auth: AuthContext,
    @Body() dto: CurrentUserEditorPreferenceUpdateDto,
  ): Promise<CurrentUserEditorPreferenceDto> {
    return this.userPreferenceService.updateEditorPreference(auth, dto);
  }

  @Post('me/avatar')
  @RateLimit(RateLimitPreset.AvatarUpload)
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
  @RateLimit(RateLimitPreset.CurrentUserWrite)
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'deleteCurrentUserAvatar' })
  @ZodResponse({ status: HttpStatus.OK, type: CurrentUserResponseDto })
  deleteCurrentUserAvatar(@Auth() auth: AuthContext): Promise<CurrentUserResponseDto> {
    return this.service.deleteAvatar(auth);
  }

  @Post('sign-up')
  @RateLimit(RateLimitPreset.AuthSignUp)
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
  @RateLimit(RateLimitPreset.AuthLogin)
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

  @Get('oidc/provider')
  @ApiOperation({ operationId: 'getOidcLoginProvider' })
  @ZodResponse({ status: HttpStatus.OK, type: OidcLoginProviderDto })
  getOidcLoginProvider(): Promise<OidcLoginProviderDto> {
    return this.service.getOidcLoginProvider();
  }

  @Post('oidc/start')
  @RateLimit(RateLimitPreset.AuthOidcStart)
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: OidcLoginStartDto })
  @ApiOperation({ operationId: 'startOidcLogin' })
  @ZodResponse({ status: HttpStatus.OK, type: OidcLoginStartResponseDto })
  startOidcLogin(@Body() dto: OidcLoginStartDto): Promise<OidcLoginStartResponseDto> {
    return this.service.startOidcLogin(dto);
  }

  @Get('oidc/callback')
  @RateLimit(RateLimitPreset.AuthOidcCallback)
  @ApiOperation({ operationId: 'completeOidcLogin' })
  async completeOidcLogin(
    @Res() response: Response,
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    try {
      const result = await this.service.completeOidcLogin(query);
      respondWithAuthCookies(response, result.login, {
        accessToken: result.login.accessToken,
        authType: AuthType.Oidc,
        secure: this.service.getCookieSecureDefault(),
      });
      response.redirect(result.redirectTo);
    } catch {
      response.redirect(this.service.createOidcFailureRedirect());
    }
  }

  @Post('logout')
  @RateLimit(RateLimitPreset.AuthLogout)
  @Authenticated({ allowTemporaryPassword: true })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'logout' })
  @ZodResponse({ status: HttpStatus.OK, type: LogoutResponseDto })
  async logout(@Res({ passthrough: true }) res: Response, @Auth() auth: AuthContext): Promise<LogoutResponseDto> {
    await this.service.logout(auth);
    return clearAuthCookies(res, { successful: true });
  }

  @Post('password-reset/request')
  @RateLimit(RateLimitPreset.AuthPasswordResetRequest)
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: PasswordResetRequestDto })
  @ApiOperation({ operationId: 'requestPasswordReset' })
  @ZodResponse({ status: HttpStatus.OK, type: PasswordResetRequestResponseDto })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<PasswordResetRequestResponseDto> {
    return this.service.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  @RateLimit(RateLimitPreset.AuthPasswordResetConfirm)
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: PasswordResetConfirmDto })
  @ApiOperation({ operationId: 'confirmPasswordReset' })
  @ZodResponse({ status: HttpStatus.OK, type: PasswordResetConfirmResponseDto })
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<PasswordResetConfirmResponseDto> {
    return this.service.confirmPasswordReset(dto);
  }

  @Post('api-keys')
  @RateLimit(RateLimitPreset.ApiKeyCreate)
  @Authenticated()
  @RequirePermission(Permission.ApiKeyManage)
  @ApiBody({ type: ApiKeyCreateDto })
  @ApiOperation({ operationId: 'createApiKey' })
  @ZodResponse({ status: HttpStatus.CREATED, type: ApiKeyCreateResponseDto })
  createApiKey(@Auth() auth: AuthContext, @Body() dto: ApiKeyCreateDto): Promise<ApiKeyCreateResponseDto> {
    return this.service.createApiKey(auth, dto);
  }

  @Get('api-keys')
  @Authenticated()
  @RequirePermission(Permission.ApiKeyManage)
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getApiKeys' })
  @ZodResponse({ status: HttpStatus.OK, type: ApiKeyListResponseDto })
  getApiKeys(@Auth() auth: AuthContext, @Query() query: ApiKeyListQueryDto): Promise<ApiKeyListResponseDto> {
    return this.service.getApiKeys(auth, query);
  }

  @Delete('api-keys/:apiKeyId')
  @RateLimit(RateLimitPreset.ApiKeyCreate)
  @Authenticated()
  @RequirePermission(Permission.ApiKeyManage)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'apiKeyId', type: String })
  @ApiOperation({ operationId: 'revokeApiKey' })
  @ZodResponse({ status: HttpStatus.OK, type: ApiKeyRevokeResponseDto })
  revokeApiKey(@Auth() auth: AuthContext, @Param('apiKeyId') apiKeyId: string): Promise<ApiKeyRevokeResponseDto> {
    return this.service.revokeApiKey(auth, apiKeyId);
  }
}
