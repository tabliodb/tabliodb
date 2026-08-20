import { AuthService } from './auth.service.js';
import { BackgroundJobService } from './background-job.service.js';
import { CollaborationService } from './collaboration.service.js';
import { CommentService } from './comment.service.js';
import { DiagramShareLinkService } from './diagram-share-link.service.js';
import { DiagramService } from './diagram.service.js';
import { DiagramReviewService } from './diagram-review.service.js';
import { FileService } from './file.service.js';
import { InvitationService } from './invitation.service.js';
import { MailService } from './mail.service.js';
import { MetricsService } from './metrics.service.js';
import { NotificationRealtimeService } from './notification-realtime.service.js';
import { NotificationService } from './notification.service.js';
import { OrganizationService } from './organization.service.js';
import { PermissionService } from './permission.service.js';
import { ProjectService } from './project.service.js';
import { RedisService } from './redis.service.js';
import { ReviewSignalService } from './review-signal.service.js';
import { ServerService } from './server.service.js';
import { SetupService } from './setup.service.js';
import { SnapshotService } from './snapshot.service.js';
import { TeamService } from './team.service.js';
import { UserPreferenceService } from './user-preference.service.js';
import { UserService } from './user.service.js';

export const services = [
  AuthService,
  BackgroundJobService,
  CollaborationService,
  CommentService,
  DiagramShareLinkService,
  DiagramService,
  DiagramReviewService,
  FileService,
  InvitationService,
  MailService,
  MetricsService,
  NotificationRealtimeService,
  NotificationService,
  OrganizationService,
  PermissionService,
  ProjectService,
  RedisService,
  ReviewSignalService,
  ServerService,
  SetupService,
  SnapshotService,
  TeamService,
  UserPreferenceService,
  UserService,
];
