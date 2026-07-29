export * as generated from './fetch-client.js';
export * from './fetch-errors.js';
export * from './request-options.js';
export * from './resources/auth.js';
export * from './resources/comments.js';
export * from './resources/diagrams.js';
export * from './resources/projects.js';
export * from './resources/setup.js';
export * from './resources/snapshots.js';
export * from './resources/users.js';

import { configureTabliodbSdk, type TabliodbClientOptions } from './request-options.js';
import { createAuthResource } from './resources/auth.js';
import { createCommentsResource } from './resources/comments.js';
import { createDiagramsResource } from './resources/diagrams.js';
import { createProjectsResource } from './resources/projects.js';
import { createSetupResource } from './resources/setup.js';
import { createSnapshotsResource } from './resources/snapshots.js';
import { createUsersResource } from './resources/users.js';

export function createTabliodbSdk(options: TabliodbClientOptions = {}) {
  const requestOptions = configureTabliodbSdk(options);

  return {
    auth: createAuthResource(requestOptions),
    comments: createCommentsResource(requestOptions),
    diagrams: createDiagramsResource(requestOptions),
    projects: createProjectsResource(requestOptions),
    setup: createSetupResource(requestOptions),
    snapshots: createSnapshotsResource(requestOptions),
    users: createUsersResource(requestOptions),
  };
}
