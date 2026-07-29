import { AuthService } from './auth.service.js';
import { CollaborationService } from './collaboration.service.js';
import { CommentService } from './comment.service.js';
import { DiagramService } from './diagram.service.js';
import { ProjectService } from './project.service.js';
import { ServerService } from './server.service.js';
import { SetupService } from './setup.service.js';
import { SnapshotService } from './snapshot.service.js';
import { UserService } from './user.service.js';

export const services = [
  AuthService,
  CollaborationService,
  CommentService,
  DiagramService,
  ProjectService,
  ServerService,
  SetupService,
  SnapshotService,
  UserService,
];
