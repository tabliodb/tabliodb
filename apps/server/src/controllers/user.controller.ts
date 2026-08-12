import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  UserCreateDto,
  UserListQueryDto,
  UserListResponseDto,
  UserPasswordResetDto,
  UserPasswordResetResponseDto,
  UserResponseDto,
  UserSessionRevokeResponseDto,
  UserStatusUpdateDto,
} from '../dtos/user.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { UserService } from '../services/user.service.js';

@ApiTags('users')
@Controller('users')
@Authenticated()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermission(Permission.OrganizationManage)
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ enum: ['owner', 'instance-admin', 'org-admin', 'member'], name: 'role', required: false })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOperation({ operationId: 'getUsers' })
  @ZodResponse({ status: HttpStatus.OK, type: UserListResponseDto })
  getUsers(@Auth() auth: AuthContext, @Query() query: UserListQueryDto): Promise<UserListResponseDto> {
    return this.userService.getAll(auth, query);
  }

  @Post()
  @RateLimit(RateLimitPreset.UserWrite)
  @RequirePermission(Permission.OrganizationManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: UserCreateDto })
  @ApiOperation({ operationId: 'createUser' })
  @ZodResponse({ status: HttpStatus.CREATED, type: UserResponseDto })
  createUser(@Auth() auth: AuthContext, @Body() dto: UserCreateDto): Promise<UserResponseDto> {
    return this.userService.create(auth, dto);
  }

  @Patch(':userId/status')
  @RateLimit(RateLimitPreset.UserWrite)
  @RequirePermission(Permission.OrganizationManage)
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: UserStatusUpdateDto })
  @ApiOperation({ operationId: 'updateUserStatus' })
  @ZodResponse({ status: HttpStatus.OK, type: UserResponseDto })
  updateUserStatus(
    @Auth() auth: AuthContext,
    @Param('userId') userId: string,
    @Body() dto: UserStatusUpdateDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateStatus(auth, userId, dto);
  }

  @Post(':userId/reset-password')
  @RateLimit(RateLimitPreset.UserPasswordReset)
  @RequirePermission(Permission.OrganizationManage)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: UserPasswordResetDto })
  @ApiOperation({ operationId: 'resetUserPassword' })
  @ZodResponse({ status: HttpStatus.OK, type: UserPasswordResetResponseDto })
  resetUserPassword(
    @Auth() auth: AuthContext,
    @Param('userId') userId: string,
    @Body() dto: UserPasswordResetDto,
  ): Promise<UserPasswordResetResponseDto> {
    return this.userService.resetPassword(auth, userId, dto);
  }

  @Post(':userId/revoke-sessions')
  @RateLimit(RateLimitPreset.UserWrite)
  @RequirePermission(Permission.OrganizationManage)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'userId', type: String })
  @ApiOperation({ operationId: 'revokeUserSessions' })
  @ZodResponse({ status: HttpStatus.OK, type: UserSessionRevokeResponseDto })
  revokeUserSessions(
    @Auth() auth: AuthContext,
    @Param('userId') userId: string,
  ): Promise<UserSessionRevokeResponseDto> {
    return this.userService.revokeSessions(auth, userId);
  }
}
