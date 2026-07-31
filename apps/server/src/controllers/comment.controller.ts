import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  CommentListResponseDto,
  CommentReplyCreateDto,
  CommentThreadCreateDto,
  CommentThreadReadStateDto,
  CommentThreadListQueryDto,
  CommentThreadListResponseDto,
  CommentThreadResponseDto,
  CommentThreadStatusResponseDto,
} from '../dtos/comment.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { CommentService } from '../services/comment.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('comments')
@Controller('comments')
@Authenticated()
export class CommentController {
  constructor(private readonly service: CommentService) {}

  @Post('threads')
  @RequirePermission(Permission.DiagramComment, { key: 'diagramId', source: 'body', type: 'diagram' })
  @ApiBody({ type: CommentThreadCreateDto })
  @ApiOperation({ operationId: 'createCommentThread' })
  @ZodResponse({ status: HttpStatus.CREATED, type: CommentThreadResponseDto })
  createThread(@Auth() auth: AuthContext, @Body() dto: CommentThreadCreateDto) {
    return this.service.createThread(auth, dto);
  }

  @Get('diagram/:diagramId/threads')
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getCommentThreads' })
  @ZodResponse({ type: CommentThreadListResponseDto })
  getThreads(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: CommentThreadListQueryDto,
  ) {
    return this.service.getThreads(auth, diagramId, query);
  }

  @Get('threads/:threadId/comments')
  @ApiParam({ name: 'threadId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getThreadComments' })
  @ZodResponse({ type: CommentListResponseDto })
  getThreadComments(
    @Auth() auth: AuthContext,
    @Param('threadId') threadId: string,
    @Query() query: CommentThreadListQueryDto,
  ) {
    return this.service.getThreadComments(auth, threadId, query);
  }

  @Post('threads/:threadId/comments')
  @ApiParam({ name: 'threadId', type: String })
  @ApiBody({ type: CommentReplyCreateDto })
  @ApiOperation({ operationId: 'replyToCommentThread' })
  @ZodResponse({ status: HttpStatus.CREATED, type: CommentThreadResponseDto })
  replyToThread(@Auth() auth: AuthContext, @Param('threadId') threadId: string, @Body() dto: CommentReplyCreateDto) {
    return this.service.replyToThread(auth, threadId, dto);
  }

  @Get('threads/:threadId/read-state')
  @ApiParam({ name: 'threadId', type: String })
  @ApiOperation({ operationId: 'getCommentThreadReadState' })
  @ZodResponse({ type: CommentThreadReadStateDto })
  getThreadReadState(@Auth() auth: AuthContext, @Param('threadId') threadId: string) {
    return this.service.getThreadReadState(auth, threadId);
  }

  @Patch('threads/:threadId/read')
  @ApiParam({ name: 'threadId', type: String })
  @ApiOperation({ operationId: 'markCommentThreadRead' })
  @ZodResponse({ type: CommentThreadReadStateDto })
  markThreadRead(@Auth() auth: AuthContext, @Param('threadId') threadId: string) {
    return this.service.markThreadRead(auth, threadId);
  }

  @Patch('threads/:threadId/resolve')
  @ApiParam({ name: 'threadId', type: String })
  @ApiOperation({ operationId: 'resolveCommentThread' })
  @ZodResponse({ type: CommentThreadStatusResponseDto })
  resolveThread(@Auth() auth: AuthContext, @Param('threadId') threadId: string) {
    return this.service.resolveThread(auth, threadId);
  }

  @Patch('threads/:threadId/unresolve')
  @ApiParam({ name: 'threadId', type: String })
  @ApiOperation({ operationId: 'unresolveCommentThread' })
  @ZodResponse({ type: CommentThreadStatusResponseDto })
  unresolveThread(@Auth() auth: AuthContext, @Param('threadId') threadId: string) {
    return this.service.unresolveThread(auth, threadId);
  }
}
