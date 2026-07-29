import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tabliodb API')
    .setDescription('Collaborative database schema designer API')
    .setVersion('0.1.0')
    // Pemanggil generated SDK cukup memakai base URL ".../api", mengikuti ergonomi SDK Immich.
    .addServer('/api')
    .addBearerAuth()
    .addCookieAuth('tabliodb_access_token')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    // Path generated tetap "/auth/login"; global prefix "/api" dimiliki baseUrl SDK.
    ignoreGlobalPrefix: true,
  });

  const cleanDocument = cleanupOpenApiDoc(document, { version: '3.0' });
  return stripNullableEnumNulls(cleanDocument);
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, createOpenApiDocument(app));
}

function stripNullableEnumNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => stripNullableEnumNulls(item));
    return value;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const node = value as Record<string, unknown>;
  if (node.nullable === true && Array.isArray(node.enum)) {
    // OpenAPI 3.0 menandai nullability lewat `nullable`; jika `null` ikut masuk enum, oazapfts menghasilkan enum member tanpa initializer.
    node.enum = node.enum.filter((item) => item !== null);
  }

  Object.values(node).forEach((child) => stripNullableEnumNulls(child));
  return value;
}
