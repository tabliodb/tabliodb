import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ConfigRepository } from './repositories/config.repository.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { setupOpenApi } from './utils/openapi.js';
import { StructuredLogger } from './utils/structured-logger.js';
import type { TabliodbEnv } from './config/env.js';
import { createDevelopmentCorsOptions, createProductionCorsOptions } from './utils/cors.js';

const bootstrapLogger = new StructuredLogger();

async function bootstrap(logger: StructuredLogger = bootstrapLogger) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
  const config = app.get(ConfigRepository);
  const { security, server } = config.getEnv();

  // Docker and orchestration platforms stop containers with SIGTERM; shutdown hooks let Nest call OnModuleDestroy before exit.
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  configureTrustedProxy(app, security.trustedProxy);
  app.setGlobalPrefix('api');
  app.use(requestIdMiddleware());
  app.use(cookieParser());
  app.use(createHelmetMiddleware(security));

  if (config.isDevelopment()) {
    app.enableCors(createDevelopmentCorsOptions());
  } else {
    app.enableCors(createProductionCorsOptions(security.corsOrigins));
  }

  setupOpenApi(app);
  configureStaticWeb(app, server.webDistPath);

  await listen(app, server, logger);
}

async function listen(
  app: NestExpressApplication,
  server: { host?: string; port: number },
  logger: StructuredLogger,
): Promise<void> {
  if (server.host) {
    await app.listen(server.port, server.host);
  } else {
    await app.listen(server.port);
  }

  logger.log({
    event: 'server.started',
    host: server.host ?? '0.0.0.0',
    port: server.port,
  });
}

function configureTrustedProxy(
  app: NestExpressApplication,
  trustedProxy: TabliodbEnv['security']['trustedProxy'],
): void {
  if (trustedProxy === false) {
    return;
  }

  const expressApp = app.getHttpAdapter().getInstance() as { set: (setting: string, value: unknown) => void };

  // Reverse proxy deployments need Express to trust X-Forwarded-* before code derives secure protocol, host, or client IP.
  expressApp.set('trust proxy', trustedProxy);
}

function createHelmetMiddleware(security: TabliodbEnv['security']) {
  return helmet({
    contentSecurityPolicy: security.contentSecurityPolicy
      ? {
          directives: {
            'base-uri': ["'self'"],
            'connect-src': ["'self'", ...security.cspConnectSources],
            'default-src': ["'self'"],
            'font-src': ["'self'", 'data:'],
            'form-action': ["'self'"],
            'frame-ancestors': ["'none'"],
            'img-src': ["'self'", 'data:', 'blob:'],
            'object-src': ["'none'"],
            'script-src': ["'self'"],
            'style-src': ["'self'", "'unsafe-inline'"],
          },
          useDefaults: false,
        }
      : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: {
      policy: 'no-referrer',
    },
  });
}

function configureStaticWeb(app: NestExpressApplication, webDistPath: string): void {
  const indexPath = path.join(webDistPath, 'index.html');

  if (!existsSync(indexPath)) {
    return;
  }

  // Production Docker copies the Vite build here so one self-host container can serve API and frontend together.
  app.useStaticAssets(webDistPath, { index: false });

  const expressApp = app.getHttpAdapter().getInstance() as {
    get: (route: RegExp, handler: (request: Request, response: Response, next: NextFunction) => void) => void;
  };

  expressApp.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => {
    // React Router owns non-API browser routes; returning index.html keeps refresh/deep-link behavior intact.
    response.sendFile(indexPath);
  });
}

void bootstrap().catch((error) => {
  bootstrapLogger.fatal(
    {
      event: 'server.start_failed',
      message: formatBootstrapError(error),
    },
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});

function formatBootstrapError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
