# Tabliodb

Tabliodb adalah open-source collaborative database schema designer: AntV X6 untuk ERD canvas, Yjs/Hocuspocus untuk realtime editing, PostgreSQL untuk persistence, dan SDK TypeScript untuk konsumsi API dari web/CLI/integrasi eksternal.

## Struktur Monorepo

- `apps/server`: NestJS API, Kysely repositories, auth/session, Hocuspocus realtime server, migration.
- `apps/web`: React + Vite editor experience.
- `packages/schema-core`: canonical database schema model yang dipakai web, server, realtime, import/export, dan history.
- `packages/sql`: SQL generator/importer surface untuk dialect awal.
- `packages/sdk`: typed fetch client ala Immich SDK.
- `packages/shared`: permission, API envelope, dan shared constants.
- `packages/ui`: React UI primitives yang reusable.
- `e2e`: Playwright API/UI tests.
- `docker`: local development services.
- `docs`: arsitektur dan product notes.

## Quick Start

```bash
npm install
cp docker/example.env .env
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d database redis
npm run db:migrate
npm run dev:server
npm run dev:web
```

Server default: `http://localhost:4000`  
Web default: `http://localhost:5173`  
Realtime default: `ws://localhost:1234`  
PostgreSQL Docker default: `localhost:5433`

Di PowerShell, salin env dengan:

```powershell
Copy-Item docker\example.env .env
```
