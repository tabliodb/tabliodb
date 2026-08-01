import { expect, type BrowserContext } from '@playwright/test';

export const apiUrl = process.env.TABLIODB_API_URL || 'http://localhost:4000/api';
export const webUrl = process.env.TABLIODB_WEB_URL || 'http://localhost:5173';

const ownerEmail = process.env.TABLIODB_E2E_OWNER_EMAIL || 'owner@tabliodb.local';
const ownerPassword = process.env.TABLIODB_E2E_OWNER_PASSWORD || 'tabliodb-dev';
const ownerName = process.env.TABLIODB_E2E_OWNER_NAME || 'Tabliodb Owner';
const workspaceName = process.env.TABLIODB_E2E_WORKSPACE_NAME || 'Personal Workspace';
const csrfCookieName = 'tabliodb_csrf_token';

export type E2eProject = {
  id: string;
  organizationId: string;
  organizationSlug: string;
  name: string;
};

export type E2eDiagram = {
  id: string;
  name: string;
  projectId: string;
};

export async function ensureOwnerSession(context: BrowserContext): Promise<boolean> {
  const setupResponse = await context.request.get(`${apiUrl}/setup`);
  expect(setupResponse.ok()).toBeTruthy();

  const setupStatus = (await setupResponse.json()) as { isSetupComplete: boolean };

  if (!setupStatus.isSetupComplete) {
    const completeSetupResponse = await context.request.post(`${apiUrl}/setup`, {
      data: {
        ownerEmail,
        ownerName,
        ownerPassword,
        publicUrl: webUrl,
        workspaceName,
      },
    });

    // Parallel local e2e runs can race the first setup wizard; a 400 means another run completed it first.
    expect([201, 400]).toContain(completeSetupResponse.status());
  }

  const currentUserResponse = await context.request.get(`${apiUrl}/auth/me`);
  if (currentUserResponse.ok()) {
    return true;
  }

  const loginResponse = await context.request.post(`${apiUrl}/auth/login`, {
    data: {
      email: ownerEmail,
      password: ownerPassword,
    },
  });

  return loginResponse.ok();
}

export async function createRealtimeSmokeDiagram(
  context: BrowserContext,
): Promise<{ diagram: E2eDiagram; path: string; project: E2eProject; tableName: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const project = await createProject(context, `Realtime Smoke ${suffix}`);
  const diagram = await createDiagram(context, project.id, `Realtime Smoke Diagram ${suffix}`);
  const tableName = 'books';

  await importDiagramModel(context, diagram.id, createSmokeDiagramModel(diagram.name, tableName));

  return {
    diagram,
    path: `/workspaces/${encodeURIComponent(project.organizationSlug || project.organizationId)}/projects/${encodeURIComponent(
      project.id,
    )}/diagrams/${encodeURIComponent(diagram.id)}`,
    project,
    tableName,
  };
}

export async function csrfHeaders(context: BrowserContext): Promise<Record<string, string>> {
  const cookies = await context.cookies(apiUrl);
  const csrfCookie = cookies.find((cookie) => cookie.name === csrfCookieName);

  if (!csrfCookie) {
    throw new Error('CSRF cookie is missing. Call ensureOwnerSession() before mutating API state.');
  }

  return {
    // API mutations use cookie auth in e2e, so they must mirror the browser double-submit CSRF header.
    'x-csrf-token': csrfCookie.value,
  };
}

async function createProject(context: BrowserContext, name: string): Promise<E2eProject> {
  const organizationsResponse = await context.request.get(`${apiUrl}/organizations?limit=1`);
  expect(organizationsResponse.ok()).toBeTruthy();

  const organizations = (await organizationsResponse.json()) as {
    items: Array<{ id: string; slug: string }>;
  };
  const organization = organizations.items[0];

  if (!organization) {
    throw new Error('E2E owner does not have a workspace.');
  }

  const response = await context.request.post(`${apiUrl}/projects`, {
    data: {
      description: 'Created by realtime collaboration smoke test.',
      name,
      organizationId: organization.id,
    },
    headers: await csrfHeaders(context),
  });
  expect(response.ok()).toBeTruthy();

  return (await response.json()) as E2eProject;
}

async function createDiagram(context: BrowserContext, projectId: string, name: string): Promise<E2eDiagram> {
  const response = await context.request.post(`${apiUrl}/diagrams`, {
    data: {
      dialect: 'postgresql',
      name,
      projectId,
    },
    headers: await csrfHeaders(context),
  });
  expect(response.ok()).toBeTruthy();

  return (await response.json()) as E2eDiagram;
}

async function importDiagramModel(context: BrowserContext, diagramId: string, model: unknown): Promise<void> {
  const response = await context.request.post(`${apiUrl}/diagrams/${diagramId}/import`, {
    data: {
      content: `${JSON.stringify(model)}\n`,
      mode: 'replace',
      source: 'tabliodb_json',
    },
    headers: await csrfHeaders(context),
  });

  expect(response.ok()).toBeTruthy();
}

function createSmokeDiagramModel(diagramName: string, tableName: string) {
  return {
    checks: {},
    columns: {
      'books-id': {
        autoIncrement: false,
        id: 'books-id',
        name: 'id',
        nullable: false,
        primaryKey: true,
        tableId: 'books',
        type: { family: 'uuid' },
        unique: false,
      },
      'books-title': {
        autoIncrement: false,
        id: 'books-title',
        name: 'title',
        nullable: false,
        primaryKey: false,
        tableId: 'books',
        type: { family: 'varchar', length: 220 },
        unique: false,
      },
    },
    dialect: 'postgresql',
    enums: {},
    groups: {},
    indexes: {},
    metadata: {
      name: diagramName,
      tableMinWidth: 240,
      updatedAt: new Date().toISOString(),
    },
    notes: {},
    relationships: {},
    schemaVersion: 1,
    tables: {
      books: {
        columnIds: ['books-id', 'books-title'],
        id: 'books',
        indexIds: [],
        name: tableName,
        position: { x: 120, y: 120 },
        width: 288,
      },
    },
  };
}
