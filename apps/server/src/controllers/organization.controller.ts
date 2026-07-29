import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { AuditLogListQueryDto, AuditLogListResponseDto } from '../dtos/audit-log.dto.js';
import {
  OrganizationListQueryDto,
  OrganizationListResponseDto,
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

  @Get()
  @RequirePermission(Permission.OrganizationRead)
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getOrganizations' })
  @ZodResponse({ type: OrganizationListResponseDto })
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
  @ZodResponse({ type: OrganizationSettingsDto })
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
  @ZodResponse({ type: OrganizationSettingsDto })
  updateOrganizationSettings(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Body() dto: OrganizationSettingsUpdateDto,
  ): Promise<OrganizationSettingsDto> {
    return this.organizationService.updateSettings(auth, organizationId, dto);
  }

  @Get(':organizationId/audit-logs')
  @RequirePermission(Permission.OrganizationManage, { key: 'organizationId', source: 'param', type: 'organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getOrganizationAuditLogs' })
  @ZodResponse({ type: AuditLogListResponseDto })
  getOrganizationAuditLogs(
    @Auth() auth: AuthContext,
    @Param('organizationId') organizationId: string,
    @Query() query: AuditLogListQueryDto,
  ): Promise<AuditLogListResponseDto> {
    return this.organizationService.getAuditLogs(auth, organizationId, query);
  }
}
