#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from '../app.module.js';
import { createOpenApiDocument } from '../utils/openapi.js';

async function syncOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const document = createOpenApiDocument(app);
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, '../../../..');
  const outputDir = path.join(repoRoot, 'open-api');
  const outputPath = path.join(outputDir, 'tabliodb-openapi-specs.json');

  await mkdir(outputDir, { recursive: true });
  // JSON yang stabil membuat perubahan OpenAPI mudah direview sebelum SDK digenerate ulang.
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();

  console.log(`OpenAPI spec synced: ${path.relative(repoRoot, outputPath)}`);
}

void syncOpenApi().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
