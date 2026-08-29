import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { AdminAuditLogListQueryDto, AuditLogListResponseDto } from '../dtos/audit-log.dto.js';
import { AdminBackgroundJobListQueryDto, AdminBackgroundJobListResponseDto } from '../dtos/background-job.dto.js';
import { AdminWorkspaceListQueryDto, AdminWorkspaceListResponseDto } from '../dtos/organization.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { AdminService } from '../services/admin.service.js';
import { OrganizationService } from '../services/organization.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('admin')
@Controller('admin')
@Authenticated()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Get('audit-logs')
  @ApiPaginationQuery()
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOperation({ operationId: 'getAdminAuditLogs' })
  @ZodResponse({ status: HttpStatus.OK, type: AuditLogListResponseDto })
  getAuditLogs(@Auth() auth: AuthContext, @Query() query: AdminAuditLogListQueryDto): Promise<AuditLogListResponseDto> {
    return this.adminService.getAuditLogs(auth, query);
  }

  @Get('jobs')
  @ApiPaginationQuery()
  @ApiQuery({ name: 'queue', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ enum: ['queued', 'running', 'completed', 'failed', 'dead'], name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiOperation({ operationId: 'getAdminBackgroundJobs' })
  @ZodResponse({ status: HttpStatus.OK, type: AdminBackgroundJobListResponseDto })
  getBackgroundJobs(
    @Auth() auth: AuthContext,
    @Query() query: AdminBackgroundJobListQueryDto,
  ): Promise<AdminBackgroundJobListResponseDto> {
    return this.adminService.getBackgroundJobs(auth, query);
  }

  @Get('workspaces')
  @ApiPaginationQuery()
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOperation({ operationId: 'getAdminWorkspaces' })
  @ZodResponse({ status: HttpStatus.OK, type: AdminWorkspaceListResponseDto })
  getWorkspaces(
    @Auth() auth: AuthContext,
    @Query() query: AdminWorkspaceListQueryDto,
  ): Promise<AdminWorkspaceListResponseDto> {
    return this.organizationService.getManagedWorkspaces(auth, query);
  }
}
