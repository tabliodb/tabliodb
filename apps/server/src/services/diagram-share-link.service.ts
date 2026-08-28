import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  createEmptyDiagramModel,
  decodeDiagramModelFromYjsUpdate,
  normalizeDiagramModel,
  repairDiagramModel,
  serializeDiagramModel,
  type DatabaseDialect,
  type DiagramModel,
} from '@tabliodb/schema-core';
import { AuditAction } from '../constants.js';
import type { AuthContext } from '../database.js';
import {
  DiagramShareLinkCreateDto,
  DiagramShareLinkCreateResponseDto,
  DiagramShareLinkDto,
  DiagramShareLinkListQueryDto,
  DiagramShareLinkListResponseDto,
  DiagramShareLinkRevokeResponseDto,
  PublicDiagramShareResponseDto,
} from '../dtos/share-link.dto.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { CollaborationRepository } from '../repositories/collaboration.repository.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import {
  DiagramShareLinkAccessContext,
  DiagramShareLinkRecord,
  DiagramShareLinkRepository,
  PublicDiagramShareLinkRecord,
} from '../repositories/diagram-share-link.repository.js';
import type { JsonValue } from '../schema/index.js';
import { toIsoDateTime, toNullableIsoDateTime } from '../utils/date-time.js';
import { clampPaginationLimit } from '../utils/pagination.js';

@Injectable()
export class DiagramShareLinkService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly collaborationRepository: CollaborationRepository,
    private readonly configRepository: ConfigRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly diagramShareLinkRepository: DiagramShareLinkRepository,
  ) {}

  async create(
    auth: AuthContext,
    diagramId: string,
    dto: DiagramShareLinkCreateDto,
  ): Promise<DiagramShareLinkCreateResponseDto> {
    const diagram = await this.requireDiagramContext(diagramId);
    const targetType = dto.targetType ?? 'diagram';
    const snapshotId = targetType === 'snapshot' ? dto.snapshotId : null;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (targetType === 'snapshot' && !snapshotId) {
      throw new BadRequestException('Snapshot id is required for snapshot share links');
    }

    if (targetType === 'diagram' && dto.snapshotId) {
      throw new BadRequestException('Snapshot id can only be used with snapshot share links');
    }

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Share link expiry must be in the future');
    }

    if (snapshotId && !(await this.diagramShareLinkRepository.hasSnapshotInDiagram(diagramId, snapshotId))) {
      throw new NotFoundException('Snapshot not found');
    }

    const token = this.cryptoRepository.randomBytesAsText(32);
    const shareLink = await this.diagramShareLinkRepository.create({
      createdById: auth.user.id,
      diagramId,
      expiresAt,
      label: dto.label?.trim() || null,
      snapshotId,
      targetType,
      // Token public tidak pernah disimpan plaintext; hanya hash yang dipakai untuk lookup ketika URL dibuka.
      tokenHash: this.cryptoRepository.hashSha256(token),
    });

    await this.recordShareLinkAudit(auth, diagram, {
      action: AuditAction.DiagramShareLinkCreated,
      entityId: shareLink.id,
      metadata: {
        expiresAt: shareLink.expiresAt ? toIsoDateTime(shareLink.expiresAt) : null,
        label: shareLink.label,
        snapshotId: shareLink.snapshotId,
        targetType: shareLink.targetType,
      },
    });

    return {
      shareLink: this.serializeShareLink(shareLink),
      token,
      url: this.buildPublicShareUrl(token),
    };
  }

  async list(
    auth: AuthContext,
    diagramId: string,
    query: DiagramShareLinkListQueryDto,
  ): Promise<DiagramShareLinkListResponseDto> {
    const shareLinks = await this.diagramShareLinkRepository.getByDiagram(diagramId, {
      cursor: query.cursor,
      limit: clampPaginationLimit(query.limit),
    });

    return {
      ...shareLinks,
      items: shareLinks.items.map((shareLink) => this.serializeShareLink(shareLink)),
    };
  }

  async getPublicByToken(token: string): Promise<PublicDiagramShareResponseDto> {
    const shareLink = await this.diagramShareLinkRepository.getActiveByTokenHash(
      this.cryptoRepository.hashSha256(token),
    );

    if (!shareLink) {
      throw new NotFoundException('Share link not found');
    }

    const model =
      shareLink.targetType === 'snapshot'
        ? this.loadSnapshotShareModel(shareLink)
        : await this.loadCurrentDiagramShareModel(shareLink);

    await this.diagramShareLinkRepository.markUsed(shareLink.id);

    return {
      diagram: {
        dialect: shareLink.dialect as DatabaseDialect,
        id: shareLink.diagramId,
        name: shareLink.diagramName,
        organizationName: shareLink.organizationName,
        folderName: shareLink.folderName,
      },
      model,
      share: {
        expiresAt: toNullableIsoDateTime(shareLink.expiresAt),
        targetType: shareLink.targetType,
      },
      snapshot:
        shareLink.targetType === 'snapshot'
          ? {
              createdAt: toIsoDateTime(shareLink.snapshotCreatedAt ?? shareLink.createdAt),
              id: shareLink.snapshotId ?? shareLink.id,
              message: shareLink.snapshotMessage,
              version: shareLink.snapshotVersion ?? 1,
            }
          : null,
    };
  }

  async revoke(auth: AuthContext, diagramId: string, shareLinkId: string): Promise<DiagramShareLinkRevokeResponseDto> {
    const diagram = await this.requireDiagramContext(diagramId);
    const shareLink = await this.diagramShareLinkRepository.revoke(diagramId, shareLinkId);

    if (!shareLink) {
      throw new NotFoundException('Share link not found');
    }

    await this.recordShareLinkAudit(auth, diagram, {
      action: AuditAction.DiagramShareLinkRevoked,
      entityId: shareLink.id,
      metadata: {
        snapshotId: shareLink.snapshotId,
        targetType: shareLink.targetType,
      },
    });

    return { successful: true };
  }

  private async requireDiagramContext(diagramId: string): Promise<DiagramShareLinkAccessContext> {
    const diagram = await this.diagramShareLinkRepository.getDiagramAccessContext(diagramId);

    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return diagram;
  }

  private async loadCurrentDiagramShareModel(shareLink: PublicDiagramShareLinkRecord): Promise<DiagramModel> {
    const fallback = createEmptyDiagramModel(shareLink.diagramName, shareLink.dialect as DatabaseDialect);
    const update = await this.collaborationRepository.loadDocument(shareLink.diagramId);

    if (!update) {
      return fallback;
    }

    return serializeDiagramModel(normalizeDiagramModel(decodeDiagramModelFromYjsUpdate(update, fallback)));
  }

  private loadSnapshotShareModel(shareLink: PublicDiagramShareLinkRecord): DiagramModel {
    if (!shareLink.snapshotModel) {
      // Kondisi ini seharusnya hanya terjadi jika data lama tidak konsisten; jangan fallback ke live draft karena snapshot link harus immutable.
      throw new NotFoundException('Snapshot not found');
    }

    return serializeDiagramModel(repairDiagramModel(shareLink.snapshotModel));
  }

  private serializeShareLink(shareLink: DiagramShareLinkRecord): DiagramShareLinkDto {
    return {
      accessCount: Number(shareLink.accessCount),
      createdAt: toIsoDateTime(shareLink.createdAt),
      createdById: shareLink.createdById,
      createdByName: shareLink.createdByName,
      diagramId: shareLink.diagramId,
      expiresAt: toNullableIsoDateTime(shareLink.expiresAt),
      id: shareLink.id,
      label: shareLink.label,
      lastUsedAt: toNullableIsoDateTime(shareLink.lastUsedAt),
      revokedAt: toNullableIsoDateTime(shareLink.revokedAt),
      snapshotId: shareLink.snapshotId,
      status: this.getStatus(shareLink),
      targetType: shareLink.targetType,
      updatedAt: toIsoDateTime(shareLink.updatedAt),
    };
  }

  private getStatus(shareLink: DiagramShareLinkRecord): DiagramShareLinkDto['status'] {
    if (shareLink.revokedAt) {
      return 'revoked';
    }

    if (shareLink.expiresAt && new Date(shareLink.expiresAt).getTime() <= Date.now()) {
      return 'expired';
    }

    return 'active';
  }

  private buildPublicShareUrl(token: string): string {
    const publicUrl = this.configRepository.getEnv().server.publicUrl.replace(/\/+$/, '');

    return `${publicUrl}/share/${token}`;
  }

  private recordShareLinkAudit(
    auth: AuthContext,
    diagram: DiagramShareLinkAccessContext,
    options: {
      action: AuditAction.DiagramShareLinkCreated | AuditAction.DiagramShareLinkRevoked;
      entityId: string;
      metadata: JsonValue;
    },
  ) {
    return this.auditLogRepository.create({
      action: options.action,
      actorId: auth.user.id,
      diagramId: diagram.diagramId,
      entityId: options.entityId,
      entityType: 'diagram_share_link',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: options.metadata,
      organizationId: diagram.organizationId,
      folderId: diagram.folderId,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });
  }
}
