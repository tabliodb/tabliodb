import { Controller, Get, HttpStatus, Query, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import { ZodResponse } from 'nestjs-zod';
import type { AuthContext } from '../database.js';
import {
  NotificationInboxListQueryDto,
  NotificationInboxListResponseDto,
  NotificationSummaryDto,
} from '../dtos/notification.dto.js';
import { Auth, Authenticated } from '../middleware/auth.guard.js';
import { NotificationService } from '../services/notification.service.js';
import { ApiPaginationQuery } from '../utils/openapi-decorators.js';

@ApiTags('notifications')
@Controller('notifications')
@Authenticated()
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get('inbox')
  @ApiPaginationQuery()
  @ApiOperation({ operationId: 'getNotificationInbox' })
  @ZodResponse({ status: HttpStatus.OK, type: NotificationInboxListResponseDto })
  getInbox(@Auth() auth: AuthContext, @Query() query: NotificationInboxListQueryDto) {
    return this.service.getInbox(auth, query);
  }

  @Get('summary')
  @ApiOperation({ operationId: 'getNotificationSummary' })
  @ZodResponse({ status: HttpStatus.OK, type: NotificationSummaryDto })
  getSummary(@Auth() auth: AuthContext) {
    return this.service.getSummary(auth);
  }

  @Sse('stream')
  @ApiExcludeEndpoint()
  stream(@Auth() auth: AuthContext): Observable<MessageEvent> {
    return this.service.stream(auth);
  }
}
