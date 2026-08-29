import { ForbiddenException, Injectable } from '@nestjs/common';
import { Permission, isGranted } from '@tabliodb/shared';
import type { AuthContext } from '../database.js';
import { AdminAuditLogListQueryDto, AuditLogListResponseDto } from '../dtos/audit-log.dto.js';
import { AdminBackgroundJobListQueryDto, AdminBackgroundJobListResponseDto } from '../dtos/background-job.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { BackgroundJobRecord, BackgroundJobRepository } from '../repositories/background-job.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly backgroundJobRepository: BackgroundJobRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getAuditLogs(auth: AuthContext, query: AdminAuditLogListQueryDto): Promise<AuditLogListResponseDto> {
    await this.requireInstanceManager(auth);

    const auditLogs = await this.auditLogRepository.listForInstance({
      action: query.action,
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      organizationId: query.organizationId,
      search: query.search,
    });

    return {
      ...auditLogs,
      items: auditLogs.items.map((auditLog) => ({
        ...auditLog,
        createdAt: toIsoDateTime(auditLog.createdAt),
        metadata: auditLog.metadata as Record<string, JsonValue>,
      })),
    };
  }

  async getBackgroundJobs(
    auth: AuthContext,
    query: AdminBackgroundJobListQueryDto,
  ): Promise<AdminBackgroundJobListResponseDto> {
    await this.requireInstanceManager(auth);

    const jobs = await this.backgroundJobRepository.listForInstance({
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
      queue: query.queue,
      search: query.search,
      status: query.status,
      type: query.type,
    });

    return {
      ...jobs,
      items: jobs.items.map((job) => this.serializeBackgroundJob(job)),
    };
  }

  private async requireInstanceManager(auth: AuthContext): Promise<void> {
    if (auth.apiKey && !isGranted({ current: auth.apiKey.permissions, requested: [Permission.OrganizationManage] })) {
      // Instance audit exposes cross-workspace behavior, so API keys must be intentionally scoped for admin usage.
      throw new ForbiddenException(`${Permission.OrganizationManage} API key scope is required`);
    }

    const instanceMember = await this.userRepository.getInstanceRole(auth.user.id);
    if (!instanceMember) {
      throw new ForbiddenException('Instance admin access is required');
    }
  }

  private serializeBackgroundJob(job: BackgroundJobRecord): AdminBackgroundJobListResponseDto['items'][number] {
    return {
      attempts: job.attempts,
      completedAt: job.completedAt ? toIsoDateTime(job.completedAt) : null,
      createdAt: toIsoDateTime(job.createdAt),
      error: job.error,
      failedAt: job.failedAt ? toIsoDateTime(job.failedAt) : null,
      id: job.id,
      lockedAt: job.lockedAt ? toIsoDateTime(job.lockedAt) : null,
      lockedBy: job.lockedBy,
      maxAttempts: job.maxAttempts,
      payload: job.payload,
      priority: job.priority,
      queue: job.queue,
      result: job.result,
      scheduledAt: toIsoDateTime(job.scheduledAt),
      startedAt: job.startedAt ? toIsoDateTime(job.startedAt) : null,
      status: job.status,
      type: job.type,
      updatedAt: toIsoDateTime(job.updatedAt),
    };
  }
}
