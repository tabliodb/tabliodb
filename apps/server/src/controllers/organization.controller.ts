import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { AuditLogListQueryDto, AuditLogListResponseDto } from '../dtos/audit-log.dto.js';
import {
  OrganizationCreateDto,
  OrganizationDto,
  OrganizationListQueryDto,
  OrganizationListResponseDto,
  OrganizationMemberDto,
  OrganizationMemberListQueryDto,
  OrganizationMemberListResponseDto,
  OrganizationMemberRemoveResponseDto,
  OrganizationMemberUpdateDto,
  OrganizationSettingsDto,
  OrganizationSettingsUpdateDto,
} from '../dtos/organization.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { OrganizationService } from '../services/organization.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('organizations')
@Controller('organizations')
@Authenticated()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiBody({ type: OrganizationCreateDto })
  @ApiOperation({ operationId: 'createOrganization' })
  @ZodResponse({ status: HttpStatus.CREATED, type: OrganizationDto })
  createOrganization(@Auth() auth: AuthContext, @Body() dto: OrganizationCreateDto): Promise<OrganizationDto> {
    return this.organizationService.create(auth, dto);
  }

  @Get()
  @RequirePermission(Permission.OrganizationRead)
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getOrganizations' })
  @ZodResponse({ status: HttpStatus.OK, type: OrganizationListResponseDto })
  getOrganizations(
    @Auth() auth: AuthContext,
    @Query() query: OrganizationListQueryDto,
  ): Promise<OrganizationListResponseDto> {
    return this.organizationService.getAll(auth, query);
  }

  @Get(':organizationId/settings')
  @RequirePermission(Permission.OrganizationRead, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiOperation({ operationId: 'getOrganizationSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: OrganizationSettingsDto })
  getOrganizationSettings(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
  ): Promise<OrganizationSettingsDto> {
    return this.organizationService.getSettings(auth, organizationId);
  }

  @Patch(':organizationId/settings')
  @RequirePermission(Permission.OrganizationManage, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiBody({ type: OrganizationSettingsUpdateDto })
  @ApiOperation({ operationId: 'updateOrganizationSettings' })
  @ZodResponse({ status: HttpStatus.OK, type: OrganizationSettingsDto })
  updateOrganizationSettings(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Body() dto: OrganizationSettingsUpdateDto,
  ): Promise<OrganizationSettingsDto> {
    return this.organizationService.updateSettings(auth, organizationId, dto);
  }

  @Get(':organizationId/members')
  @RequirePermission(Permission.OrganizationManage, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getOrganizationMembers' })
  @ZodResponse({ status: HttpStatus.OK, type: OrganizationMemberListResponseDto })
  getOrganizationMembers(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Query() query: OrganizationMemberListQueryDto,
  ): Promise<OrganizationMemberListResponseDto> {
    return this.organizationService.getMembers(auth, organizationId, query);
  }

  @Patch(':organizationId/members/:userId')
  @RequirePermission(Permission.OrganizationManage, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: OrganizationMemberUpdateDto })
  @ApiOperation({ operationId: 'updateOrganizationMember' })
  @ZodResponse({ status: HttpStatus.OK, type: OrganizationMemberDto })
  updateOrganizationMember(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Body() dto: OrganizationMemberUpdateDto,
  ): Promise<OrganizationMemberDto> {
    return this.organizationService.updateMemberRole(auth, organizationId, userId, dto);
  }

  @Delete(':organizationId/members/:userId')
  @RequirePermission(Permission.OrganizationManage, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiOperation({ operationId: 'removeOrganizationMember' })
  @ZodResponse({ status: HttpStatus.OK, type: OrganizationMemberRemoveResponseDto })
  removeOrganizationMember(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
  ): Promise<OrganizationMemberRemoveResponseDto> {
    return this.organizationService.removeMember(auth, organizationId, userId);
  }

  @Get(':organizationId/audit-logs')
  @RequirePermission(Permission.OrganizationManage, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getOrganizationAuditLogs' })
  @ZodResponse({ status: HttpStatus.OK, type: AuditLogListResponseDto })
  getOrganizationAuditLogs(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Query() query: AuditLogListQueryDto,
  ): Promise<AuditLogListResponseDto> {
    return this.organizationService.getAuditLogs(auth, organizationId, query);
  }
}
