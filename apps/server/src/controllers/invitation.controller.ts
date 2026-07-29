import { Body, Controller, Get, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import { AuthType } from '../constants.js';
import type { AuthContext } from '../database.js';
import {
  InvitationAcceptDto,
  InvitationAcceptResponseDto,
  InvitationCreateDto,
  InvitationCreateResponseDto,
  InvitationPublicDto,
} from '../dtos/invitation.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { InvitationService } from '../services/invitation.service.js';
import { respondWithAuthCookies } from '../utils/response.js';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationController {
  constructor(private readonly service: InvitationService) {}

  @Post()
  @Authenticated()
  @RequirePermission(Permission.OrganizationManage)
  @ApiBody({ type: InvitationCreateDto })
  @ApiOperation({ operationId: 'createInvitation' })
  @ZodResponse({ status: HttpStatus.CREATED, type: InvitationCreateResponseDto })
  createInvitation(@Auth() auth: AuthContext, @Body() dto: InvitationCreateDto): Promise<InvitationCreateResponseDto> {
    return this.service.create(auth, dto);
  }

  @Get(':token')
  @ApiParam({ name: 'token', type: String })
  @ApiOperation({ operationId: 'getInvitationByToken' })
  @ZodResponse({ type: InvitationPublicDto })
  getInvitationByToken(@Param('token') token: string): Promise<InvitationPublicDto> {
    return this.service.getByToken(token);
  }

  @Post('accept')
  @ApiBody({ type: InvitationAcceptDto })
  @ApiOperation({ operationId: 'acceptInvitation' })
  @ZodResponse({ status: HttpStatus.CREATED, type: InvitationAcceptResponseDto })
  async acceptInvitation(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: InvitationAcceptDto,
  ): Promise<InvitationAcceptResponseDto> {
    const body = await this.service.accept(dto);

    return respondWithAuthCookies(res, body, {
      accessToken: body.accessToken,
      authType: AuthType.Password,
      secure: this.service.getCookieSecureDefault(),
    });
  }
}
