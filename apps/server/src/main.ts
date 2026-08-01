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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigRepository);
  const { server } = config.getEnv();

  app.setGlobalPrefix('api');
  app.use(requestIdMiddleware());
  app.use(cookieParser());
  app.use(helmet());

  if (config.isDevelopment()) {
    app.enableCors({
      credentials: true,
      origin: true,
    });
  }

  setupOpenApi(app);
  configureStaticWeb(app, server.webDistPath);

  if (server.host) {
    await app.listen(server.port, server.host);
  } else {
    await app.listen(server.port);
  }
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

void bootstrap();
