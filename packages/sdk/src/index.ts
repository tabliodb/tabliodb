export * from './fetch-client.js';
export * from './fetch-errors.js';
export * from './resources/auth.js';
export * from './resources/comments.js';
export * from './resources/diagrams.js';
export * from './resources/projects.js';
export * from './resources/setup.js';
export * from './resources/snapshots.js';
export * from './resources/users.js';

import { TabliodbClient, type TabliodbClientOptions } from './fetch-client.js';
import { createAuthResource } from './resources/auth.js';
import { createCommentsResource } from './resources/comments.js';
import { createDiagramsResource } from './resources/diagrams.js';
import { createProjectsResource } from './resources/projects.js';
import { createSetupResource } from './resources/setup.js';
import { createSnapshotsResource } from './resources/snapshots.js';
import { createUsersResource } from './resources/users.js';

export function createTabliodbSdk(options: TabliodbClientOptions = {}) {
  const client = new TabliodbClient(options);

  return {
    auth: createAuthResource(client),
    comments: createCommentsResource(client),
    diagrams: createDiagramsResource(client),
    projects: createProjectsResource(client),
    setup: createSetupResource(client),
    snapshots: createSnapshotsResource(client),
    users: createUsersResource(client),
  };
}
