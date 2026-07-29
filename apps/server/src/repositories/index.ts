import { ApiKeyRepository } from './api-key.repository.js';
import { CollaborationRepository } from './collaboration.repository.js';
import { CommentRepository } from './comment.repository.js';
import { ConfigRepository } from './config.repository.js';
import { CryptoRepository } from './crypto.repository.js';
import { DatabaseRepository } from './database.repository.js';
import { DiagramRepository } from './diagram.repository.js';
import { OrganizationRepository } from './organization.repository.js';
import { ProjectRepository } from './project.repository.js';
import { SessionRepository } from './session.repository.js';
import { SnapshotRepository } from './snapshot.repository.js';
import { UserRepository } from './user.repository.js';

export const repositories = [
  ApiKeyRepository,
  CollaborationRepository,
  CommentRepository,
  ConfigRepository,
  CryptoRepository,
  DatabaseRepository,
  DiagramRepository,
  OrganizationRepository,
  ProjectRepository,
  SessionRepository,
  SnapshotRepository,
  UserRepository,
];
