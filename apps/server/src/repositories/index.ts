import { ApiKeyRepository } from './api-key.repository.js';
import { AuditLogRepository } from './audit-log.repository.js';
import { CollaborationRepository } from './collaboration.repository.js';
import { CommentRepository } from './comment.repository.js';
import { ConfigRepository } from './config.repository.js';
import { CryptoRepository } from './crypto.repository.js';
import { DatabaseRepository } from './database.repository.js';
import { DiagramRepository } from './diagram.repository.js';
import { InvitationRepository } from './invitation.repository.js';
import { OrganizationRepository } from './organization.repository.js';
import { PasswordResetRepository } from './password-reset.repository.js';
import { ProjectRepository } from './project.repository.js';
import { ReviewSignalRepository } from './review-signal.repository.js';
import { SessionRepository } from './session.repository.js';
import { SetupRepository } from './setup.repository.js';
import { SnapshotRepository } from './snapshot.repository.js';
import { UserRepository } from './user.repository.js';

export const repositories = [
  ApiKeyRepository,
  AuditLogRepository,
  CollaborationRepository,
  CommentRepository,
  ConfigRepository,
  CryptoRepository,
  DatabaseRepository,
  DiagramRepository,
  InvitationRepository,
  OrganizationRepository,
  PasswordResetRepository,
  ProjectRepository,
  ReviewSignalRepository,
  SessionRepository,
  SetupRepository,
  SnapshotRepository,
  UserRepository,
];
