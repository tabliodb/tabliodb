import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Database } from '@hocuspocus/extension-database';
import { Redis as HocuspocusRedis } from '@hocuspocus/extension-redis';
import { Server } from '@hocuspocus/server';
import { Redis as RedisClient } from 'ioredis';
import type { IncomingHttpHeaders } from 'node:http';
import {
  Permission,
  ProjectRole,
  REALTIME_PERSISTED_ACK_TYPE,
  REALTIME_SESSION_PROOF_TOKEN_TYPE,
  diagramDocumentName,
  isGranted,
  parseDiagramDocumentName,
  permissionsForProjectRole,
  realtimeSessionProofPath,
  type AwarenessState,
  type RealtimePersistedAckMessage,
} from '@tabliodb/shared';
import type { AuthContext } from '../database.js';
import { AuthService } from './auth.service.js';
import {
  CollaborationRepository,
  type StoredRealtimeDocumentReceipt,
} from '../repositories/collaboration.repository.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';

@Injectable()
export class CollaborationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollaborationService.name);
  private readonly pendingDocumentStores = new Map<string, PendingDocumentStore>();
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

    const realtimeRedisUrl = realtime.redisUrl;
    const extensions = [
      ...(realtimeRedisUrl
        ? [
            new HocuspocusRedis({
              awaitInitialSyncTimeout: 1000,
              createClient: () =>
                new RedisClient(realtimeRedisUrl, {
                  maxRetriesPerRequest: null,
                }).on('error', (error) => {
                  this.logger.warn({
                    event: 'realtime.redis_error',
                    message: formatErrorMessage(error),
                  });
                }),
              // Namespace khusus membuat channel/lock realtime tidak berbenturan dengan rate limit, cache, atau job key lain.
              prefix: 'tabliodb:hocuspocus',
            }),
          ]
        : []),
      new Database({
        fetch: async ({ documentName }) => {
          try {
            const parsed = parseDiagramDocumentName(documentName);
            return parsed ? this.collaborationRepository.loadDocument(parsed.diagramId) : null;
          } catch (error) {
            this.logger.error(
              {
                documentName,
                event: 'realtime.document_fetch_failed',
                message: formatErrorMessage(error),
              },
              formatErrorStack(error),
            );
            throw error;
          }
        },
        store: async ({ documentName, lastContext, state }) => {
          try {
            const parsed = parseDiagramDocumentName(documentName);
            const context = readCollaborationContext(lastContext);

            if (parsed && context && !context.readOnly) {
              // Realtime persistence only accepts updates from users that can update the diagram, mirroring REST snapshot permissions.
              this.scheduleDocumentStore(parsed.diagramId, state);
            }
          } catch (error) {
            this.logger.error(
              {
                documentName,
                event: 'realtime.document_store_failed',
                message: formatErrorMessage(error),
              },
              formatErrorStack(error),
            );
            throw error;
          }
        },
      }),
    ];

    if (realtimeRedisUrl) {
      this.logger.log('Hocuspocus Redis pub/sub enabled for multi-instance realtime sync.');
    }

    this.server = new Server({
      port: realtime.port,
      onAuthenticate: async ({
        connectionConfig,
        documentName,
        requestHeaders,
        requestParameters,
        socketId,
        token,
      }) => {
        try {
          const parsed = parseDiagramDocumentName(documentName);
          if (!parsed) {
            throw new UnauthorizedException('Invalid realtime document');
          }

          const auth = await this.authenticateRealtimeConnection({
            documentName,
            requestHeaders,
            requestParameters,
            token: String(token || ''),
          });
          const context = await this.createConnectionContext(auth, parsed.diagramId);
          connectionConfig.readOnly = context.readOnly;

          this.logger.log({
            diagramId: parsed.diagramId,
            event: 'realtime.connection_authenticated',
            readOnly: context.readOnly,
            role: context.role,
            socketId,
            userId: context.userId,
          });

          // The context becomes available to later Hocuspocus hooks and gives us a clean boundary for authorization.
          return context;
        } catch (error) {
          this.logger.warn({
            documentName,
            event: 'realtime.connection_rejected',
            message: formatErrorMessage(error),
            socketId,
          });
          throw error;
        }
      },
      beforeHandleAwareness: async ({ context, states }) => {
        try {
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
        } catch (error) {
          this.logger.warn({
            event: 'realtime.awareness_sanitization_failed',
            message: formatErrorMessage(error),
          });
          states.clear();
        }
      },
      onConnect: async ({ documentName, socketId }) => {
        this.logger.debug({
          documentName,
          event: 'realtime.connection_opened',
          socketId,
        });
      },
      onDisconnect: async ({ clientsCount, context, documentName, socketId }) => {
        const collaborationContext = readCollaborationContext(context);

        this.logger.debug({
          clientsCount,
          diagramId: collaborationContext?.diagramId,
          documentName,
          event: 'realtime.connection_closed',
          socketId,
          userId: collaborationContext?.userId,
        });
      },
      onDestroy: async () => {
        this.logger.log({
          event: 'realtime.server_destroyed',
        });
      },
      extensions,
    });

    try {
      await this.server.listen();
      this.logger.log({
        event: 'realtime.server_started',
        port: realtime.port,
        redisEnabled: Boolean(realtimeRedisUrl),
      });
    } catch (error) {
      this.server = undefined;
      this.logger.error(
        {
          event: 'realtime.listen_failed',
          message: formatErrorMessage(error),
          port: realtime.port,
        },
        formatErrorStack(error),
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.server && this.pendingDocumentStores.size === 0) {
      return;
    }

    this.logger.log({
      event: 'realtime.server_stopping',
      pendingDocumentStores: this.pendingDocumentStores.size,
    });
    await this.flushPendingDocumentStores();

    try {
      await this.server?.destroy();
    } catch (error) {
      this.logger.error(
        {
          event: 'realtime.server_destroy_failed',
          message: formatErrorMessage(error),
        },
        formatErrorStack(error),
      );
      throw error;
    } finally {
      this.server = undefined;
    }
  }

  private scheduleDocumentStore(diagramId: string, state: Uint8Array): void {
    const { realtime } = this.configRepository.getEnv();
    const existingStore = this.pendingDocumentStores.get(diagramId);

    if (existingStore?.timer) {
      clearTimeout(existingStore.timer);
    }

    const timer = setTimeout(
      () => {
        void this.flushPendingDocumentStore(diagramId);
      },
      Math.max(realtime.persistDebounceMs, 0),
    );

    timer.unref?.();
    this.pendingDocumentStores.set(diagramId, {
      // Hocuspocus may reuse buffers internally, so the pending write keeps an owned copy of the newest document state.
      state: new Uint8Array(state),
      timer,
    });
  }

  private async flushPendingDocumentStores(): Promise<void> {
    const pendingDiagramIds = Array.from(this.pendingDocumentStores.keys());

    await Promise.all(pendingDiagramIds.map((diagramId) => this.flushPendingDocumentStore(diagramId)));
  }

  private async flushPendingDocumentStore(diagramId: string): Promise<void> {
    const pendingStore = this.pendingDocumentStores.get(diagramId);

    if (!pendingStore) {
      return;
    }

    clearTimeout(pendingStore.timer);
    this.pendingDocumentStores.delete(diagramId);

    try {
      const receipt = await this.collaborationRepository.storeDocument(diagramId, pendingStore.state);

      this.broadcastDocumentPersisted(diagramId, receipt);
      this.logger.debug({
        diagramId,
        event: 'realtime.document_persisted',
        persistedAt: receipt.persistedAt,
        version: receipt.version,
      });
    } catch (error) {
      this.logger.warn(`Failed to persist realtime document "${diagramId}". ${formatErrorMessage(error)}`);
    }
  }

  private broadcastDocumentPersisted(diagramId: string, receipt: StoredRealtimeDocumentReceipt): void {
    const documentName = diagramDocumentName(diagramId);
    const document = this.server?.hocuspocus.documents.get(documentName);

    if (!document) {
      return;
    }

    const message: RealtimePersistedAckMessage = {
      diagramId,
      modelUpdatedAt: receipt.modelUpdatedAt,
      persistedAt: receipt.persistedAt,
      // Client-specific tokens let each browser confirm that the ack includes its own latest local transaction.
      persistenceTokens: receipt.persistenceTokens,
      type: REALTIME_PERSISTED_ACK_TYPE,
      version: receipt.version,
    };

    document.broadcastStateless(JSON.stringify(message));
  }

  private authenticateRealtimeConnection(options: {
    documentName: string;
    requestHeaders: Headers;
    requestParameters: URLSearchParams;
    token: string;
  }): Promise<AuthContext> {
    const headers = headersToIncomingHttpHeaders(options.requestHeaders);
    const queryParams = urlSearchParamsToRecord(options.requestParameters);
    const proofToken = parseRealtimeSessionProofToken(options.token);

    if (proofToken) {
      return this.authService
        .authenticate({
          headers,
          queryParams,
        })
        .then(async (auth) => {
          await this.authService.verifySessionProof(auth, {
            headers: proofToken.headers,
            ipAddress: readClientIpAddress(headers),
            method: 'WS',
            path: realtimeSessionProofPath(options.documentName),
            userAgent: readHeader(headers['user-agent']),
          });

          return auth;
        });
    }

    if (options.token) {
      return this.authService.validateSessionToken(options.token).then((auth) => {
        this.assertRealtimeProofNotRequired(auth);
        return auth;
      });
    }

    // Browser clients keep the session token in an httpOnly cookie, so realtime auth mirrors REST by reading the WebSocket handshake.
    return this.authService
      .authenticate({
        headers,
        queryParams,
      })
      .then((auth) => {
        this.assertRealtimeProofNotRequired(auth);
        return auth;
      });
  }

  private assertRealtimeProofNotRequired(auth: AuthContext): void {
    if (auth.session?.bindingRequired) {
      throw new UnauthorizedException('Realtime session proof is required for this browser-bound session');
    }
  }

  private async createConnectionContext(auth: AuthContext, diagramId: string): Promise<CollaborationContext> {
    const role = await this.projectRepository.getDiagramRole(auth.user.id, diagramId);
    if (!role) {
      throw new UnauthorizedException('Diagram access denied');
    }

    this.assertApiKeyRealtimeScope(auth, Permission.DiagramRead);

    const readOnly =
      !isGranted({
        current: permissionsForProjectRole(role.role),
        requested: [Permission.DiagramUpdate],
      }) || !this.isApiKeyGranted(auth, Permission.DiagramUpdate);

    return {
      user: {
        avatarUrl: auth.user.avatarUrl,
        cursorColor: auth.user.cursorColor,
        id: auth.user.id,
        name: auth.user.name,
      },
      userId: auth.user.id,
      diagramId,
      role: role.role,
      // Hocuspocus enforces this flag before document mutations, so viewer/commenter/API keys without update scope cannot bypass REST permissions through WebSocket.
      readOnly,
    };
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

type PendingDocumentStore = {
  state: Uint8Array;
  timer: NodeJS.Timeout;
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

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function headersToIncomingHttpHeaders(headers: Headers): IncomingHttpHeaders {
  const incomingHeaders: IncomingHttpHeaders = {};

  headers.forEach((value, key) => {
    incomingHeaders[key.toLowerCase()] = value;
  });

  return incomingHeaders;
}

function parseRealtimeSessionProofToken(token: string): { headers: IncomingHttpHeaders } | null {
  if (!token) {
    return null;
  }

  try {
    const parsed = JSON.parse(token) as {
      headers?: Record<string, unknown>;
      type?: unknown;
    };

    if (parsed.type !== REALTIME_SESSION_PROOF_TOKEN_TYPE || !parsed.headers || typeof parsed.headers !== 'object') {
      return null;
    }

    const headers: IncomingHttpHeaders = {};

    for (const [key, value] of Object.entries(parsed.headers)) {
      if (typeof value === 'string') {
        // Only string header values are accepted from the websocket auth token to keep the proof surface tiny.
        headers[key.toLowerCase()] = value;
      }
    }

    return { headers };
  } catch {
    return null;
  }
}

function readClientIpAddress(headers: IncomingHttpHeaders): string | null {
  const forwardedFor = readHeader(headers['x-forwarded-for']);

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return readHeader(headers['x-real-ip']);
}

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function urlSearchParamsToRecord(parameters: URLSearchParams): Record<string, string | undefined> {
  return Object.fromEntries(parameters.entries());
}
