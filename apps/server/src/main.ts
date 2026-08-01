import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { ConfigRepository } from './repositories/config.repository.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { setupOpenApi } from './utils/openapi.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  if (server.host) {
    await app.listen(server.port, server.host);
  } else {
    await app.listen(server.port);
  }
}

void bootstrap();
