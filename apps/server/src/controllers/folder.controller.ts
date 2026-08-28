import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import { DiagramListQueryDto, DiagramListResponseDto } from '../dtos/diagram.dto.js';
import {
  FolderArchiveResponseDto,
  FolderCreateDto,
  FolderListQueryDto,
  FolderListResponseDto,
  FolderAccessCreateDto,
  FolderAccessDto,
  FolderAccessListQueryDto,
  FolderAccessListResponseDto,
  FolderAccessRemoveResponseDto,
  FolderAccessUpdateDto,
  FolderOwnershipTransferDto,
  FolderResponseDto,
  FolderUpdateDto,
} from '../dtos/folder.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { DiagramService } from '../services/diagram.service.js';
import { FolderService } from '../services/folder.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('folders')
@Controller('folders')
@Authenticated()
export class FolderController {
  constructor(
    private readonly diagramService: DiagramService,
    private readonly folderService: FolderService,
  ) {}

  @Get()
  @RequirePermission(Permission.FolderRead)
  @ApiPaginationQuery()
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @ApiOperation({ operationId: 'getFolders' })
  @ZodResponse({ status: HttpStatus.OK, type: FolderListResponseDto })
  getFolders(@Auth() auth: AuthContext, @Query() query: FolderListQueryDto) {
    return this.folderService.getAll(auth, query);
  }

  @Post()
  @RateLimit(RateLimitPreset.FolderWrite)
  @RequirePermission(Permission.FolderCreate, { key: 'organizationId', source: 'body', type: 'organization' })
  @ApiBody({ type: FolderCreateDto })
  @ApiOperation({ operationId: 'createFolder' })
  @ZodResponse({ status: HttpStatus.CREATED, type: FolderResponseDto })
  createFolder(@Auth() auth: AuthContext, @Body() dto: FolderCreateDto) {
    return this.folderService.create(auth, dto);
  }

  @Patch(':folderId')
  @RateLimit(RateLimitPreset.FolderWrite)
  @RequirePermission(Permission.FolderUpdate, { key: 'folderId', source: 'param', type: 'folder' })
  @ApiParam({ name: 'folderId', type: String })
  @ApiBody({ type: FolderUpdateDto })
  @ApiOperation({ operationId: 'updateFolder' })
  @ZodResponse({ status: HttpStatus.OK, type: FolderResponseDto })
  updateFolder(@Auth() auth: AuthContext, @Param('folderId') folderId: string, @Body() dto: FolderUpdateDto) {
    return this.folderService.update(auth, folderId, dto);
  }

  @Delete(':folderId')
  @RateLimit(RateLimitPreset.FolderWrite)
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.FolderDelete, { key: 'folderId', source: 'param', type: 'folder' })
  @ApiParam({ name: 'folderId', type: String })
  @ApiOperation({ operationId: 'archiveFolder' })
  @ZodResponse({ status: HttpStatus.OK, type: FolderArchiveResponseDto })
  archiveFolder(@Auth() auth: AuthContext, @Param('folderId') folderId: string): Promise<FolderArchiveResponseDto> {
    return this.folderService.archive(auth, folderId);
  }

  @Get(':folderId/access')
  @RequirePermission(Permission.FolderAccessManage, { key: 'folderId', source: 'param', type: 'folder' })
  @ApiParam({ name: 'folderId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getFolderAccess' })
  @ZodResponse({ status: HttpStatus.OK, type: FolderAccessListResponseDto })
  getFolderAccess(
    @Auth() auth: AuthContext,
    @Param('folderId') folderId: string,
    @Query() query: FolderAccessListQueryDto,
  ): Promise<FolderAccessListResponseDto> {
    return this.folderService.getAccessList(auth, folderId, query);
  }

  @Post(':folderId/access')
  @RateLimit(RateLimitPreset.FolderWrite)
  @RequirePermission(Permission.FolderAccessManage, { key: 'folderId', source: 'param', type: 'folder' })
  @ApiParam({ name: 'folderId', type: String })
  @ApiBody({ type: FolderAccessCreateDto })
  @ApiOperation({ operationId: 'addFolderAccess' })
  @ZodResponse({ status: HttpStatus.CREATED, type: FolderAccessDto })
  addFolderAccess(
    @Auth() auth: AuthContext,
    @Param('folderId') folderId: string,
    @Body() dto: FolderAccessCreateDto,
  ): Promise<FolderAccessDto> {
    return this.folderService.addAccess(auth, folderId, dto);
  }

  @Post(':folderId/ownership/transfer')
  @RateLimit(RateLimitPreset.FolderWrite)
  @RequirePermission(Permission.FolderAccessManage, { key: 'folderId', source: 'param', type: 'folder' })
  @ApiParam({ name: 'folderId', type: String })
  @ApiBody({ type: FolderOwnershipTransferDto })
  @ApiOperation({ operationId: 'transferFolderOwnership' })
  @ZodResponse({ status: HttpStatus.OK, type: FolderAccessDto })
  transferFolderOwnership(
    @Auth() auth: AuthContext,
    @Param('folderId') folderId: string,
    @Body() dto: FolderOwnershipTransferDto,
  ): Promise<FolderAccessDto> {
    return this.folderService.transferOwnership(auth, folderId, dto);
  }

  @Patch(':folderId/access/:userId')
  @RateLimit(RateLimitPreset.FolderWrite)
  @RequirePermission(Permission.FolderAccessManage, { key: 'folderId', source: 'param', type: 'folder' })
  @ApiParam({ name: 'folderId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: FolderAccessUpdateDto })
  @ApiOperation({ operationId: 'updateFolderAccess' })
  @ZodResponse({ status: HttpStatus.OK, type: FolderAccessDto })
  updateFolderAccess(
    @Auth() auth: AuthContext,
    @Param('folderId') folderId: string,
    @Param('userId') userId: string,
    @Body() dto: FolderAccessUpdateDto,
  ): Promise<FolderAccessDto> {
    return this.folderService.updateAccess(auth, folderId, userId, dto);
  }

  @Delete(':folderId/access/:userId')
  @RateLimit(RateLimitPreset.FolderWrite)
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.FolderAccessManage, { key: 'folderId', source: 'param', type: 'folder' })
  @ApiParam({ name: 'folderId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiOperation({ operationId: 'removeFolderAccess' })
  @ZodResponse({ status: HttpStatus.OK, type: FolderAccessRemoveResponseDto })
  removeFolderAccess(
    @Auth() auth: AuthContext,
    @Param('folderId') folderId: string,
    @Param('userId') userId: string,
  ): Promise<FolderAccessRemoveResponseDto> {
    return this.folderService.removeAccess(auth, folderId, userId);
  }

  @Get(':folderId/diagrams')
  @RequirePermission(Permission.DiagramRead, { key: 'folderId', source: 'param', type: 'folder' })
  @ApiParam({ name: 'folderId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getFolderDiagrams' })
  @ZodResponse({ status: HttpStatus.OK, type: DiagramListResponseDto })
  getFolderDiagrams(
    @Auth() auth: AuthContext,
    @Param('folderId') folderId: string,
    @Query() query: DiagramListQueryDto,
  ) {
    return this.diagramService.getByFolder(auth, folderId, query);
  }
}
