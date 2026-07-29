import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../database.js';
import { CommentThreadCreateDto, CommentThreadListQueryDto } from '../dtos/comment.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { CommentService } from '../services/comment.service.js';

@ApiTags('comments')
@Controller('comments')
@Authenticated()
export class CommentController {
  constructor(private readonly service: CommentService) {}

  @Post('threads')
  createThread(@Auth() auth: AuthContext, @Body() dto: CommentThreadCreateDto) {
    return this.service.createThread(auth, dto);
  }

  @Get('diagram/:diagramId/threads')
  getThreads(
    @Auth() auth: AuthContext,
    @Param('diagramId') diagramId: string,
    @Query() query: CommentThreadListQueryDto,
  ) {
    return this.service.getThreads(auth, diagramId, query);
  }
}
