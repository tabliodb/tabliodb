import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { ConfigRepository } from './repositories/config.repository.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigRepository);
  const { server } = config.getEnv();

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(helmet());

  if (config.isDevelopment()) {
    app.enableCors({
      credentials: true,
      origin: true,
    });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tabliodb API')
    .setDescription('Collaborative database schema designer API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('tabliodb_access_token')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  if (server.host) {
    await app.listen(server.port, server.host);
  } else {
    await app.listen(server.port);
  }
}

void bootstrap();
