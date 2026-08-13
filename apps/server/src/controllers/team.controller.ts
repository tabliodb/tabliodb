import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  TeamArchiveResponseDto,
  TeamCreateDto,
  TeamListQueryDto,
  TeamListResponseDto,
  TeamMemberCreateDto,
  TeamMemberDto,
  TeamMemberListQueryDto,
  TeamMemberListResponseDto,
  TeamMemberRemoveResponseDto,
  TeamProjectAccessDto,
  TeamProjectAccessListQueryDto,
  TeamProjectAccessListResponseDto,
  TeamProjectAccessRemoveResponseDto,
  TeamProjectAccessUpsertDto,
  TeamResponseDto,
  TeamUpdateDto,
} from '../dtos/team.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RateLimitPreset } from '../middleware/rate-limit.presets.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { TeamService } from '../services/team.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('teams')
@Controller('teams')
@Authenticated()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @ApiPaginationQuery()
  @ApiQuery({ name: 'organizationId', required: true, type: String })
  @ApiOperation({ operationId: 'getTeams' })
  @ZodResponse({ status: HttpStatus.OK, type: TeamListResponseDto })
  getTeams(@Auth() auth: AuthContext, @Query() query: TeamListQueryDto): Promise<TeamListResponseDto> {
    return this.teamService.getAll(auth, query);
  }

  @Post()
  @RateLimit(RateLimitPreset.TeamWrite)
  @ApiBody({ type: TeamCreateDto })
  @ApiOperation({ operationId: 'createTeam' })
  @ZodResponse({ status: HttpStatus.CREATED, type: TeamResponseDto })
  createTeam(@Auth() auth: AuthContext, @Body() dto: TeamCreateDto): Promise<TeamResponseDto> {
    return this.teamService.create(auth, dto);
  }

  @Patch(':teamId')
  @RateLimit(RateLimitPreset.TeamWrite)
  @ApiParam({ name: 'teamId', type: String })
  @ApiBody({ type: TeamUpdateDto })
  @ApiOperation({ operationId: 'updateTeam' })
  @ZodResponse({ status: HttpStatus.OK, type: TeamResponseDto })
  updateTeam(@Auth() auth: AuthContext, @Param('teamId') teamId: string, @Body() dto: TeamUpdateDto) {
    return this.teamService.update(auth, teamId, dto);
  }

  @Delete(':teamId')
  @RateLimit(RateLimitPreset.TeamWrite)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'teamId', type: String })
  @ApiOperation({ operationId: 'archiveTeam' })
  @ZodResponse({ status: HttpStatus.OK, type: TeamArchiveResponseDto })
  archiveTeam(@Auth() auth: AuthContext, @Param('teamId') teamId: string): Promise<TeamArchiveResponseDto> {
    return this.teamService.archive(auth, teamId);
  }

  @Get(':teamId/members')
  @ApiParam({ name: 'teamId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getTeamMembers' })
  @ZodResponse({ status: HttpStatus.OK, type: TeamMemberListResponseDto })
  getTeamMembers(
    @Auth() auth: AuthContext,
    @Param('teamId') teamId: string,
    @Query() query: TeamMemberListQueryDto,
  ): Promise<TeamMemberListResponseDto> {
    return this.teamService.getMembers(auth, teamId, query);
  }

  @Post(':teamId/members')
  @RateLimit(RateLimitPreset.TeamWrite)
  @ApiParam({ name: 'teamId', type: String })
  @ApiBody({ type: TeamMemberCreateDto })
  @ApiOperation({ operationId: 'addTeamMember' })
  @ZodResponse({ status: HttpStatus.CREATED, type: TeamMemberDto })
  addTeamMember(
    @Auth() auth: AuthContext,
    @Param('teamId') teamId: string,
    @Body() dto: TeamMemberCreateDto,
  ): Promise<TeamMemberDto> {
    return this.teamService.addMember(auth, teamId, dto);
  }

  @Delete(':teamId/members/:userId')
  @RateLimit(RateLimitPreset.TeamWrite)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'teamId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiOperation({ operationId: 'removeTeamMember' })
  @ZodResponse({ status: HttpStatus.OK, type: TeamMemberRemoveResponseDto })
  removeTeamMember(
    @Auth() auth: AuthContext,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ): Promise<TeamMemberRemoveResponseDto> {
    return this.teamService.removeMember(auth, teamId, userId);
  }

  @Get(':teamId/projects')
  @ApiParam({ name: 'teamId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getTeamProjectAccesses' })
  @ZodResponse({ status: HttpStatus.OK, type: TeamProjectAccessListResponseDto })
  getTeamProjectAccesses(
    @Auth() auth: AuthContext,
    @Param('teamId') teamId: string,
    @Query() query: TeamProjectAccessListQueryDto,
  ): Promise<TeamProjectAccessListResponseDto> {
    return this.teamService.getProjectAccesses(auth, teamId, query);
  }

  @Post(':teamId/projects')
  @RateLimit(RateLimitPreset.TeamWrite)
  @ApiParam({ name: 'teamId', type: String })
  @ApiBody({ type: TeamProjectAccessUpsertDto })
  @ApiOperation({ operationId: 'upsertTeamProjectAccess' })
  @ZodResponse({ status: HttpStatus.CREATED, type: TeamProjectAccessDto })
  upsertTeamProjectAccess(
    @Auth() auth: AuthContext,
    @Param('teamId') teamId: string,
    @Body() dto: TeamProjectAccessUpsertDto,
  ): Promise<TeamProjectAccessDto> {
    return this.teamService.upsertProjectAccess(auth, teamId, dto);
  }

  @Delete(':teamId/projects/:projectId')
  @RateLimit(RateLimitPreset.TeamWrite)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'teamId', type: String })
  @ApiParam({ name: 'projectId', type: String })
  @ApiOperation({ operationId: 'removeTeamProjectAccess' })
  @ZodResponse({ status: HttpStatus.OK, type: TeamProjectAccessRemoveResponseDto })
  removeTeamProjectAccess(
    @Auth() auth: AuthContext,
    @Param('teamId') teamId: string,
    @Param('projectId') projectId: string,
  ): Promise<TeamProjectAccessRemoveResponseDto> {
    return this.teamService.removeProjectAccess(auth, teamId, projectId);
  }
}
