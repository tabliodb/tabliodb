import { Body, Controller, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  CommentThreadCreateDto,
  CommentThreadListQueryDto,
  CommentThreadListResponseDto,
  CommentThreadResponseDto,
} from '../dtos/comment.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { CommentService } from '../services/comment.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('comments')
@Controller('comments')
@Authenticated()
export class CommentController {
  constructor(private readonly service: CommentService) {}

  @Post('threads')
  @ApiBody({ type: CommentThreadCreateDto })
  @ApiOperation({ operationId: 'createCommentThread' })
  @ZodResponse({ status: HttpStatus.CREATED, type: CommentThreadResponseDto })
  createThread(@Auth() auth: AuthContext, @Body() dto: CommentThreadCreateDto) {
    return this.service.createThread(auth, dto);
  }

  @Get('diagram/:diagramId/threads')
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
}
