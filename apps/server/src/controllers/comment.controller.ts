import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tabliodb/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  CommentDiagramSummaryDto,
  CommentListQueryDto,
  CommentListResponseDto,
  CommentReplyCreateDto,
  CommentResponseDto,
  CommentThreadCreateDto,
  CommentThreadReadStateDto,
  CommentThreadListQueryDto,
  CommentThreadListResponseDto,
  CommentThreadResponseDto,
  CommentThreadStatusResponseDto,
  CommentUpdateDto,
} from '../dtos/comment.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { RequirePermission } from '../middleware/permission.guard.js';
import { RateLimit } from '../middleware/rate-limit.guard.js';
import { CommentService } from '../services/comment.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('comments')
@Controller('comments')
@Authenticated()
export class CommentController {
  constructor(private readonly service: CommentService) {}

  @Post('threads')
  @RateLimit({ key: 'comments:write', limit: 24, windowMs: 60_000 })
  @RequirePermission(Permission.DiagramComment, { key: 'diagramId', source: 'body', type: 'diagram' })
  @ApiBody({ type: CommentThreadCreateDto })
  @ApiOperation({ operationId: 'createCommentThread' })
  @ZodResponse({ status: HttpStatus.CREATED, type: CommentThreadResponseDto })
  createThread(@Auth() auth: AuthContext, @Body() dto: CommentThreadCreateDto) {
    return this.service.createThread(auth, dto);
  }

  @Get('diagram/:diagramId/summary')
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiOperation({ operationId: 'getCommentDiagramSummary' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentDiagramSummaryDto })
  getDiagramSummary(@Auth() auth: AuthContext, @Param('diagramId') diagramId: string) {
    return this.service.getDiagramSummary(auth, diagramId);
  }

  @Get('diagram/:diagramId/threads')
  @RequirePermission(Permission.DiagramRead, { key: 'diagramId', source: 'param', type: 'diagram' })
  @ApiParam({ name: 'diagramId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getCommentThreads' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentThreadListResponseDto })
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
  @ApiQuery({
    description: 'Use null to list root comments, a comment id to list direct replies, or omit it for legacy flat lists.',
    name: 'parentCommentId',
    required: false,
    type: String,
  })
  @ApiOperation({ operationId: 'getThreadComments' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentListResponseDto })
  getThreadComments(
    @Auth() auth: AuthContext,
    @Param('threadId') threadId: string,
    @Query() query: CommentListQueryDto,
  ) {
    return this.service.getThreadComments(auth, threadId, query);
  }

  @Get('threads/:threadId/root-comments')
  @ApiParam({ name: 'threadId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getCommentThreadRootComments' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentListResponseDto })
  getThreadRootComments(
    @Auth() auth: AuthContext,
    @Param('threadId') threadId: string,
    @Query() query: CommentThreadListQueryDto,
  ) {
    return this.service.getThreadRootComments(auth, threadId, query);
  }

  @Post('threads/:threadId/comments')
  @RateLimit({ key: 'comments:write', limit: 24, windowMs: 60_000 })
  @ApiParam({ name: 'threadId', type: String })
  @ApiBody({ type: CommentReplyCreateDto })
  @ApiOperation({ operationId: 'replyToCommentThread' })
  @ZodResponse({ status: HttpStatus.CREATED, type: CommentThreadResponseDto })
  replyToThread(@Auth() auth: AuthContext, @Param('threadId') threadId: string, @Body() dto: CommentReplyCreateDto) {
    return this.service.replyToThread(auth, threadId, dto);
  }

  @Get('comments/:commentId/replies')
  @ApiParam({ name: 'commentId', type: String })
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getCommentReplies' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentListResponseDto })
  getCommentReplies(
    @Auth() auth: AuthContext,
    @Param('commentId') commentId: string,
    @Query() query: CommentThreadListQueryDto,
  ) {
    return this.service.getCommentReplies(auth, commentId, query);
  }

  @Post('comments/:commentId/replies')
  @RateLimit({ key: 'comments:write', limit: 24, windowMs: 60_000 })
  @ApiParam({ name: 'commentId', type: String })
  @ApiBody({ type: CommentReplyCreateDto })
  @ApiOperation({ operationId: 'replyToComment' })
  @ZodResponse({ status: HttpStatus.CREATED, type: CommentThreadResponseDto })
  replyToComment(@Auth() auth: AuthContext, @Param('commentId') commentId: string, @Body() dto: CommentReplyCreateDto) {
    return this.service.replyToComment(auth, commentId, dto);
  }

  @Patch('comments/:commentId')
  @RateLimit({ key: 'comments:write', limit: 24, windowMs: 60_000 })
  @ApiParam({ name: 'commentId', type: String })
  @ApiBody({ type: CommentUpdateDto })
  @ApiOperation({ operationId: 'updateComment' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentResponseDto })
  updateComment(@Auth() auth: AuthContext, @Param('commentId') commentId: string, @Body() dto: CommentUpdateDto) {
    return this.service.updateComment(auth, commentId, dto);
  }

  @Delete('comments/:commentId')
  @ApiParam({ name: 'commentId', type: String })
  @ApiOperation({ operationId: 'deleteComment' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentResponseDto })
  deleteComment(@Auth() auth: AuthContext, @Param('commentId') commentId: string) {
    return this.service.deleteComment(auth, commentId);
  }

  @Get('threads/:threadId/read-state')
  @ApiParam({ name: 'threadId', type: String })
  @ApiOperation({ operationId: 'getCommentThreadReadState' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentThreadReadStateDto })
  getThreadReadState(@Auth() auth: AuthContext, @Param('threadId') threadId: string) {
    return this.service.getThreadReadState(auth, threadId);
  }

  @Patch('threads/:threadId/read')
  @ApiParam({ name: 'threadId', type: String })
  @ApiOperation({ operationId: 'markCommentThreadRead' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentThreadReadStateDto })
  markThreadRead(@Auth() auth: AuthContext, @Param('threadId') threadId: string) {
    return this.service.markThreadRead(auth, threadId);
  }

  @Patch('threads/:threadId/resolve')
  @ApiParam({ name: 'threadId', type: String })
  @ApiOperation({ operationId: 'resolveCommentThread' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentThreadStatusResponseDto })
  resolveThread(@Auth() auth: AuthContext, @Param('threadId') threadId: string) {
    return this.service.resolveThread(auth, threadId);
  }

  @Patch('threads/:threadId/unresolve')
  @ApiParam({ name: 'threadId', type: String })
  @ApiOperation({ operationId: 'unresolveCommentThread' })
  @ZodResponse({ status: HttpStatus.OK, type: CommentThreadStatusResponseDto })
  unresolveThread(@Auth() auth: AuthContext, @Param('threadId') threadId: string) {
    return this.service.unresolveThread(auth, threadId);
  }
}
