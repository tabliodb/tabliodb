import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Database } from '@hocuspocus/extension-database';
import { Server } from '@hocuspocus/server';
import type { IncomingHttpHeaders } from 'node:http';
import {
  Permission,
  ProjectRole,
  isGranted,
  parseDiagramDocumentName,
  permissionsForProjectRole,
  type AwarenessState,
} from '@tabliodb/shared';
import type { AuthContext } from '../database.js';
import { AuthService } from './auth.service.js';
import { CollaborationRepository } from '../repositories/collaboration.repository.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';

@Injectable()
export class CollaborationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollaborationService.name);
  private server?: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly collaborationRepository: CollaborationRepository,
    private readonly configRepository: ConfigRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const { realtime } = this.configRepository.getEnv();
    if (!realtime.enabled) {
      return;
    }

    this.server = new Server({
      port: realtime.port,
      onAuthenticate: async ({ connectionConfig, documentName, requestHeaders, requestParameters, token }) => {
        const parsed = parseDiagramDocumentName(documentName);
        if (!parsed) {
          throw new UnauthorizedException('Invalid realtime document');
        }

        const auth = await this.authenticateRealtimeConnection({
          requestHeaders,
          requestParameters,
          token: String(token || ''),
        });
        const role = await this.projectRepository.getDiagramRole(auth.user.id, parsed.diagramId);
        if (!role) {
          throw new UnauthorizedException('Diagram access denied');
        }

        this.assertApiKeyRealtimeScope(auth, Permission.DiagramRead);

        const readOnly =
          !isGranted({
            current: permissionsForProjectRole(role.role),
            requested: [Permission.DiagramUpdate],
          }) || !this.isApiKeyGranted(auth, Permission.DiagramUpdate);
        connectionConfig.readOnly = readOnly;

        // The context becomes available to later Hocuspocus hooks and gives us a clean boundary for authorization.
        return {
          user: {
            avatarUrl: auth.user.avatarUrl,
            cursorColor: auth.user.cursorColor,
            id: auth.user.id,
            name: auth.user.name,
          },
          userId: auth.user.id,
          diagramId: parsed.diagramId,
          role: role.role,
          readOnly,
        } satisfies CollaborationContext;
      },
      beforeHandleAwareness: async ({ context, states }) => {
        const collaborationContext = readCollaborationContext(context);

        if (!collaborationContext) {
          states.clear();
          return;
        }

        for (const [clientId, state] of states.entries()) {
          // Awareness is supplied by the client, but identity is a server-owned boundary.
          // Cursor, viewport, and selection may pass through; user identity is rewritten from the authenticated session.
          states.set(clientId, sanitizeAwarenessState(state, collaborationContext));
        }
      },
      extensions: [
        new Database({
          fetch: async ({ documentName }) => {
            const parsed = parseDiagramDocumentName(documentName);
            return parsed ? this.collaborationRepository.loadDocument(parsed.diagramId) : null;
          },
          store: async ({ documentName, lastContext, state }) => {
            const parsed = parseDiagramDocumentName(documentName);
            const context = readCollaborationContext(lastContext);

            if (parsed && context && !context.readOnly) {
              // Realtime persistence only accepts updates from users that can update the diagram, mirroring REST snapshot permissions.
              await this.collaborationRepository.storeDocument(parsed.diagramId, state);
            }
          },
        }),
      ],
    });

    await this.server.listen();
    this.logger.log(`Hocuspocus realtime server listening on ws://localhost:${realtime.port}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.server?.destroy();
  }

  private authenticateRealtimeConnection(options: {
    requestHeaders: Headers;
    requestParameters: URLSearchParams;
    token: string;
  }): Promise<AuthContext> {
    if (options.token) {
      return this.authService.validateSessionToken(options.token);
    }

    // Browser clients keep the session token in an httpOnly cookie, so realtime auth mirrors REST by reading the WebSocket handshake.
    return this.authService.authenticate({
      headers: headersToIncomingHttpHeaders(options.requestHeaders),
      queryParams: urlSearchParamsToRecord(options.requestParameters),
    });
  }

  private assertApiKeyRealtimeScope(auth: AuthContext, permission: Permission): void {
    if (auth.apiKey && !isGranted({ current: auth.apiKey.permissions, requested: [permission] })) {
      throw new UnauthorizedException('Realtime API key scope denied');
    }
  }

  private isApiKeyGranted(auth: AuthContext, permission: Permission): boolean {
    return !auth.apiKey || isGranted({ current: auth.apiKey.permissions, requested: [permission] });
  }
}

type CollaborationContext = {
  diagramId: string;
  readOnly: boolean;
  role: ProjectRole;
  user: AwarenessState['user'];
  userId: string;
};

function readCollaborationContext(value: unknown): CollaborationContext | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const context = value as Partial<CollaborationContext>;

  if (
    typeof context.diagramId === 'string' &&
    typeof context.readOnly === 'boolean' &&
    typeof context.userId === 'string' &&
    isAwarenessUser(context.user) &&
    context.role &&
    Object.values(ProjectRole).includes(context.role)
  ) {
    return context as CollaborationContext;
  }

  return null;
}

function sanitizeAwarenessState(state: Record<string, unknown>, context: CollaborationContext): AwarenessState {
  return {
    commentTyping: readCommentTyping(state.commentTyping),
    cursor: readCursor(state.cursor),
    selection: readSelection(state.selection),
    user: context.user,
    viewport: readViewport(state.viewport),
  };
}

function isAwarenessUser(value: unknown): value is AwarenessState['user'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Partial<AwarenessState['user']>;

  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    typeof user.cursorColor === 'string' &&
    (typeof user.avatarUrl === 'string' || user.avatarUrl === null)
  );
}

function readCursor(value: unknown): AwarenessState['cursor'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const cursor = value as Partial<NonNullable<AwarenessState['cursor']>>;

  return typeof cursor.x === 'number' && typeof cursor.y === 'number' ? { x: cursor.x, y: cursor.y } : undefined;
}

function readCommentTyping(value: unknown): AwarenessState['commentTyping'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const typing = value as Partial<NonNullable<AwarenessState['commentTyping']>>;

  if (
    typeof typing.threadId !== 'string' ||
    !isUuid(typing.threadId) ||
    !(typing.parentCommentId === null || (typeof typing.parentCommentId === 'string' && isUuid(typing.parentCommentId)))
  ) {
    return undefined;
  }

  return {
    parentCommentId: typing.parentCommentId,
    threadId: typing.threadId,
    // Server owns the freshness timestamp so clients cannot keep a stale typing indicator alive forever.
    updatedAt: Date.now(),
  };
}

function readSelection(value: unknown): AwarenessState['selection'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const selection = value as Partial<NonNullable<AwarenessState['selection']>>;
  const targetTypes = [
    'check',
    'column',
    'diagram',
    'enum',
    'group',
    'index',
    'note',
    'relationship',
    'table',
  ] as const;

  if (
    (typeof selection.targetId === 'string' || selection.targetId === null) &&
    selection.targetType &&
    targetTypes.includes(selection.targetType)
  ) {
    return {
      targetId: selection.targetId,
      targetType: selection.targetType,
    };
  }

  return undefined;
}

function readViewport(value: unknown): AwarenessState['viewport'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const viewport = value as Partial<NonNullable<AwarenessState['viewport']>>;

  return typeof viewport.x === 'number' && typeof viewport.y === 'number' && typeof viewport.zoom === 'number'
    ? { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
    : undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function headersToIncomingHttpHeaders(headers: Headers): IncomingHttpHeaders {
  const incomingHeaders: IncomingHttpHeaders = {};

  headers.forEach((value, key) => {
    incomingHeaders[key.toLowerCase()] = value;
  });

  return incomingHeaders;
}

function urlSearchParamsToRecord(parameters: URLSearchParams): Record<string, string | undefined> {
  return Object.fromEntries(parameters.entries());
}
