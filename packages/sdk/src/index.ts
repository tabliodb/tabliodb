export * as generated from './fetch-client.js';
export * from './fetch-errors.js';
export * from './request-options.js';
export * from './resources/auth.js';
export * from './resources/comments.js';
export * from './resources/diagrams.js';
export * from './resources/invitations.js';
export * from './resources/notifications.js';
export * from './resources/organizations.js';
export * from './resources/projects.js';
export * from './resources/review-signals.js';
export * from './resources/setup.js';
export * from './resources/snapshots.js';
export * from './resources/users.js';

import { configureTabliodbSdk, type TabliodbClientOptions } from './request-options.js';
import { createAuthResource, type AuthResource } from './resources/auth.js';
import { createCommentsResource, type CommentsResource } from './resources/comments.js';
import { createDiagramsResource, type DiagramsResource } from './resources/diagrams.js';
import { createInvitationsResource, type InvitationsResource } from './resources/invitations.js';
import { createNotificationsResource, type NotificationsResource } from './resources/notifications.js';
import { createOrganizationsResource, type OrganizationsResource } from './resources/organizations.js';
import { createProjectsResource, type ProjectsResource } from './resources/projects.js';
import { createReviewSignalsResource, type ReviewSignalsResource } from './resources/review-signals.js';
import { createSetupResource, type SetupResource } from './resources/setup.js';
import { createSnapshotsResource, type SnapshotsResource } from './resources/snapshots.js';
import { createUsersResource, type UsersResource } from './resources/users.js';

export type TabliodbSdk = {
  auth: AuthResource;
  comments: CommentsResource;
  diagrams: DiagramsResource;
  invitations: InvitationsResource;
  notifications: NotificationsResource;
  organizations: OrganizationsResource;
  projects: ProjectsResource;
  reviewSignals: ReviewSignalsResource;
  setup: SetupResource;
  snapshots: SnapshotsResource;
  users: UsersResource;
};

export function createTabliodbSdk(options: TabliodbClientOptions = {}): TabliodbSdk {
  const requestOptions = configureTabliodbSdk(options);

  return {
    auth: createAuthResource(requestOptions),
    comments: createCommentsResource(requestOptions),
    diagrams: createDiagramsResource(requestOptions),
    invitations: createInvitationsResource(requestOptions),
    notifications: createNotificationsResource(requestOptions),
    organizations: createOrganizationsResource(requestOptions),
    projects: createProjectsResource(requestOptions),
    reviewSignals: createReviewSignalsResource(requestOptions),
    setup: createSetupResource(requestOptions),
    snapshots: createSnapshotsResource(requestOptions),
    users: createUsersResource(requestOptions),
  };
}
