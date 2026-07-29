import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Database } from '@hocuspocus/extension-database';
import { Server } from '@hocuspocus/server';
import { parseDiagramDocumentName } from '@tabliodb/shared';
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
      onAuthenticate: async ({ token, documentName }) => {
        const parsed = parseDiagramDocumentName(documentName);
        if (!parsed || !token) {
          throw new UnauthorizedException('Invalid realtime document');
        }

        const auth = await this.authService.validateSessionToken(String(token));
        const role = await this.projectRepository.getDiagramRole(auth.user.id, parsed.diagramId);
        if (!role) {
          throw new UnauthorizedException('Diagram access denied');
        }

        // The context becomes available to later Hocuspocus hooks and gives us a clean boundary for authorization.
        return {
          userId: auth.user.id,
          diagramId: parsed.diagramId,
          role: role.role,
        };
      },
      extensions: [
        new Database({
          fetch: async ({ documentName }) => {
            const parsed = parseDiagramDocumentName(documentName);
            return parsed ? this.collaborationRepository.loadDocument(parsed.diagramId) : null;
          },
          store: async ({ documentName, state }) => {
            const parsed = parseDiagramDocumentName(documentName);
            if (parsed) {
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
}
