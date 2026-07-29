# Tabliodb

Tabliodb adalah open-source collaborative database schema designer: AntV X6 untuk ERD canvas, Yjs/Hocuspocus untuk realtime editing, PostgreSQL untuk persistence, dan SDK TypeScript untuk konsumsi API dari web/CLI/integrasi eksternal.

## Struktur Monorepo

- `apps/server`: NestJS API, Kysely repositories, auth/session, Hocuspocus realtime server, migration.
- `apps/web`: React + Vite editor experience.
- `packages/schema-core`: canonical database schema model yang dipakai web, server, realtime, import/export, dan history.
- `packages/sql`: SQL generator/importer surface untuk dialect awal.
- `packages/sdk`: OpenAPI-generated TypeScript SDK ala Immich.
- `packages/shared`: permission, API envelope, dan shared constants.
- `packages/ui`: React UI primitives yang reusable.
- `e2e`: Playwright API/UI tests.
- `docker`: local development services.
- `docs`: arsitektur dan product notes.

## Quick Start

```bash
npm install
cp docker/example.env .env
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d database redis db_ui
npm run db:migrate
npm run dev:server
npm run dev:web
```

Server default: `http://localhost:4000`  
Web default: `http://localhost:5173`  
Realtime default: `ws://localhost:1234`  
PostgreSQL Docker default: `localhost:5433`
Database UI default: `http://localhost:8080`

Login Adminer:

- System: `PostgreSQL`
- Server: `database`
- Username: `postgres`
- Password: `postgres`
- Database: `tabliodb`

Di PowerShell, salin env dengan:

```powershell
Copy-Item docker\example.env .env
```

## Generated SDK

SDK TypeScript di `packages/sdk/src/fetch-client.ts` digenerate dari OpenAPI spec server, mengikuti pola Immich. File generated ini jangan diedit manual.

```bash
npm run openapi:sync
npm run sdk:generate
npm run sdk:build
```

- `npm run openapi:sync` membuat `open-api/tabliodb-openapi-specs.json` dari NestJS controller dan Zod DTO.
- `npm run sdk:generate` menjalankan sync OpenAPI lalu menulis ulang generated fetch client dengan `oazapfts`.
- Facade `createTabliodbSdk()` tetap tersedia agar frontend bisa memakai `sdk.auth.login()`, `sdk.projects.list()`, dan resource lain tanpa langsung bergantung ke detail generated function.
