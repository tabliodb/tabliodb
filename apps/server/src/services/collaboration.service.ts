import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Database } from '@hocuspocus/extension-database';
import { Redis as HocuspocusRedis } from '@hocuspocus/extension-redis';
import { Hocuspocus, Server, type Configuration, type ServerConfiguration, type WebSocketLike } from '@hocuspocus/server';
import { Redis as RedisClient } from 'ioredis';
import type { IncomingHttpHeaders } from 'node:http';
import {
  Permission,
  AccessRole,
  REALTIME_PERSISTED_ACK_TYPE,
  REALTIME_SESSION_PROOF_TOKEN_TYPE,
  diagramDocumentName,
  isGranted,
  parseDiagramDocumentName,
  permissionsForAccessRole,
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
import { FolderRepository } from '../repositories/folder.repository.js';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class CollaborationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollaborationService.name);
  private readonly pendingDocumentStores = new Map<string, PendingDocumentStore>();
  private isShuttingDown = false;
  private server?: RealtimeServerHandle;

  constructor(
    private readonly authService: AuthService,
    private readonly collaborationRepository: CollaborationRepository,
    private readonly configRepository: ConfigRepository,
    private readonly metricsService: MetricsService,
    private readonly folderRepository: FolderRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const { realtime } = this.configRepository.getEnv();
    if (!realtime.enabled) {
      return;
    }

    this.isShuttingDown = false;
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

    this.server = createRealtimeServerHandle({
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
        this.recordRealtimeConnectionOpened(documentName, socketId);

        this.logger.debug({
          documentName,
          event: 'realtime.connection_opened',
          socketId,
        });
      },
      onDisconnect: async ({ clientsCount, context, documentName, socketId }) => {
        const collaborationContext = readCollaborationContext(context);

        this.recordRealtimeConnectionClosed(socketId);

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
    }, this.logger);

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
    this.isShuttingDown = true;

    if (!this.server && this.pendingDocumentStores.size === 0) {
      return;
    }

    this.logger.log({
      event: 'realtime.server_stopping',
      pendingDocumentStores: this.pendingDocumentStores.size,
    });

    await this.flushPendingDocumentStoresWithTimeout('before_destroy');
    await this.destroyRealtimeServerWithTimeout();
    await this.flushPendingDocumentStoresWithTimeout('after_destroy');
  }

  private recordRealtimeConnectionOpened(documentName: string, socketId: string): void {
    this.metricsService.recordRealtimeConnectionOpened({
      // MetricsService stores this only internally for aggregate room counts; the public metrics response never exposes it.
      roomName: documentName,
      socketId,
    });
  }

  private recordRealtimeConnectionClosed(socketId: string): void {
    this.metricsService.recordRealtimeConnectionClosed({ socketId });
  }

  private scheduleDocumentStore(diagramId: string, state: Uint8Array): void {
    const { realtime } = this.configRepository.getEnv();
    const existingStore = this.pendingDocumentStores.get(diagramId);

    if (existingStore?.timer) {
      clearTimeout(existingStore.timer);
    }

    const pendingStore: PendingDocumentStore = {
      // Hocuspocus may reuse buffers internally, so the pending write keeps an owned copy of the newest document state.
      state: new Uint8Array(state),
    };

    if (this.isShuttingDown) {
      // During shutdown we keep the newest state pending without starting a debounce timer.
      // The explicit final flush in onModuleDestroy owns persistence so SIGTERM cannot leave a stray timer behind.
      this.pendingDocumentStores.set(diagramId, pendingStore);
      return;
    }

    const timer = setTimeout(
      () => {
        void this.flushPendingDocumentStore(diagramId);
      },
      Math.max(realtime.persistDebounceMs, 0),
    );

    timer.unref?.();
    this.pendingDocumentStores.set(diagramId, {
      ...pendingStore,
      timer,
    });
  }

  private async flushPendingDocumentStoresWithTimeout(stage: 'before_destroy' | 'after_destroy'): Promise<void> {
    if (this.pendingDocumentStores.size === 0) {
      return;
    }

    const didTimeOut = await waitForPromiseOrTimeout(
      this.flushPendingDocumentStores(),
      this.getRealtimeShutdownTimeoutMs(),
    );

    if (didTimeOut) {
      this.logger.warn({
        event: 'realtime.document_flush_timeout',
        pendingDocumentStores: this.pendingDocumentStores.size,
        stage,
      });
    }
  }

  private async destroyRealtimeServerWithTimeout(): Promise<void> {
    const server = this.server;

    if (!server) {
      return;
    }

    this.server = undefined;

    try {
      const didTimeOut = await waitForPromiseOrTimeout(server.destroy(), this.getRealtimeShutdownTimeoutMs());

      if (didTimeOut) {
        this.logger.warn({
          event: 'realtime.server_destroy_timeout',
        });
      }
    } catch (error) {
      this.logger.error(
        {
          event: 'realtime.server_destroy_failed',
          message: formatErrorMessage(error),
        },
        formatErrorStack(error),
      );
    }
  }

  private getRealtimeShutdownTimeoutMs(): number {
    const { realtime } = this.configRepository.getEnv();

    return Math.max(0, realtime.shutdownTimeoutMs);
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
    const role = await this.folderRepository.getDiagramRole(auth.user.id, diagramId);
    if (!role) {
      throw new UnauthorizedException('Diagram access denied');
    }

    this.assertApiKeyRealtimeScope(auth, Permission.DiagramRead);

    const readOnly =
      !isGranted({
        current: permissionsForAccessRole(role.role),
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
  role: AccessRole;
  user: AwarenessState['user'];
  userId: string;
};

type PendingDocumentStore = {
  state: Uint8Array;
  timer?: NodeJS.Timeout;
};

type RealtimeServerConfiguration = Partial<ServerConfiguration<CollaborationContext>> & {
  port: number;
};

type RealtimeServerHandle = {
  hocuspocus: Hocuspocus<CollaborationContext>;
  destroy(): Promise<void>;
  listen(): Promise<void>;
};

type BunRuntime = {
  serve(options: BunServeOptions): BunServerInstance;
};

type BunServeOptions = {
  fetch(request: Request, server: BunUpgradeServer): Response | Promise<Response | undefined> | undefined;
  hostname?: string;
  port: number;
  websocket: unknown;
};

type BunServerInstance = {
  port: number;
  stop(force?: boolean): void | Promise<void>;
};

type BunUpgradeServer = {
  upgrade(request: Request, options?: unknown): boolean;
};

type BunCrosswsFactory = (options: {
  hooks: {
    close(peer: BunPeer, event: BunCloseEvent): void;
    error(peer: BunPeer, error: unknown): void;
    message(peer: BunPeer, message: BunMessage): void;
    open(peer: BunPeer): void;
  };
}) => BunCrosswsAdapter;

type BunCrosswsAdapter = {
  handleUpgrade(request: Request, server: BunUpgradeServer): Promise<Response | undefined> | Response | undefined;
  websocket: unknown;
};

type BunPeer = {
  close(code?: number, reason?: string): void;
  id: string;
  request: Request;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  websocket: {
    readyState?: number;
  };
};

type BunMessage = {
  uint8Array(): Uint8Array;
};

type BunCloseEvent = {
  code?: number;
  reason?: string;
};

function createRealtimeServerHandle(
  configuration: RealtimeServerConfiguration,
  logger: Logger,
): RealtimeServerHandle {
  if (isBunRuntime()) {
    return new BunRealtimeServerHandle(configuration, logger);
  }

  const nodeServer = new Server(configuration);

  return {
    hocuspocus: nodeServer.hocuspocus,
    async listen() {
      await nodeServer.listen();
    },
    destroy() {
      return nodeServer.destroy();
    },
  };
}

class BunRealtimeServerHandle implements RealtimeServerHandle {
  readonly hocuspocus: Hocuspocus<CollaborationContext>;
  private bunServer?: BunServerInstance;
  private readonly clientConnections = new WeakMap<BunPeer, ReturnType<Hocuspocus<CollaborationContext>['handleConnection']>>();
  private readonly hostname?: string;
  private readonly port: number;

  constructor(configuration: RealtimeServerConfiguration, private readonly logger: Logger) {
    const {
      address,
      port,
      stopOnSignals: _stopOnSignals,
      websocketOptions: _websocketOptions,
      ...hocuspocusConfiguration
    } = configuration;

    this.hostname = address;
    this.port = port;
    // Hocuspocus `Server` hard-wires the Node crossws adapter. Bun needs the core Hocuspocus instance so the websocket adapter can be selected per runtime.
    this.hocuspocus = new Hocuspocus(hocuspocusConfiguration as Partial<Configuration<CollaborationContext>>);
  }

  async listen(): Promise<void> {
    const bun = readBunRuntime();
    const { default: createBunCrossws } = (await import('crossws/adapters/bun')) as {
      default: BunCrosswsFactory;
    };

    const websocketAdapter = createBunCrossws({
      hooks: {
        open: (peer) => {
          // Bun wraps ServerWebSocket with a Proxy, so Hocuspocus receives a tiny WebSocketLike facade that delegates to crossws peer methods.
          const socket: WebSocketLike = {
            get readyState() {
              return peer.websocket.readyState ?? 3;
            },
            send: (data) => {
              peer.send(data);
            },
            close: (code, reason) => {
              peer.close(code, reason);
            },
          };

          this.clientConnections.set(peer, this.hocuspocus.handleConnection(socket, peer.request));
        },
        message: (peer, message) => {
          this.clientConnections.get(peer)?.handleMessage(message.uint8Array());
        },
        close: (peer, event) => {
          this.clientConnections.get(peer)?.handleClose({
            // crossws marks Bun close payload values as optional; Hocuspocus expects concrete websocket close metadata.
            code: event.code ?? 1000,
            reason: event.reason ?? '',
          });
          this.clientConnections.delete(peer);
        },
        error: (peer, error) => {
          this.logger.warn({
            event: 'realtime.bun_websocket_error',
            message: formatErrorMessage(error),
            peerId: peer.id,
          });
        },
      },
    });

    this.bunServer = bun.serve({
      hostname: this.hostname,
      port: this.port,
      websocket: websocketAdapter.websocket,
      fetch: async (request, server) => {
        if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
          // A successful Bun websocket upgrade returns undefined by design; failed upgrades return a normal HTTP Response from crossws.
          return websocketAdapter.handleUpgrade(request, server);
        }

        return new Response('Welcome to Hocuspocus!', {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
          },
        });
      },
    });

    await this.hocuspocus.hooks('onListen', {
      configuration: this.hocuspocus.configuration,
      instance: this.hocuspocus,
      port: this.bunServer.port,
    });
  }

  async destroy(): Promise<void> {
    const server = this.bunServer;
    this.bunServer = undefined;

    if (server) {
      // `force: true` closes active sockets during application shutdown so Nest does not hang behind an open Bun server.
      await server.stop(true);
    }

    this.hocuspocus.closeConnections();
    this.hocuspocus.flushPendingStores();
    await this.hocuspocus.hooks('onDestroy', { instance: this.hocuspocus });
  }
}

function isBunRuntime(): boolean {
  return Boolean((globalThis as { Bun?: unknown }).Bun);
}

function readBunRuntime(): BunRuntime {
  const bun = (globalThis as { Bun?: BunRuntime }).Bun;

  if (!bun) {
    throw new Error('Bun runtime is required for the Hocuspocus Bun realtime adapter.');
  }

  return bun;
}

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
    Object.values(AccessRole).includes(context.role)
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

async function waitForPromiseOrTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  if (timeoutMs <= 0) {
    // The operation has already been started by the caller; attach a rejection handler so an intentional immediate timeout
    // does not become an unhandled rejection after shutdown has already continued.
    void promise.catch(() => undefined);
    return true;
  }

  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise.then(() => false),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(true), timeoutMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
