<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/tabliodb-logo-stacked-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/tabliodb-logo-stacked.svg">
    <img alt="TablioDB Logo" src="docs/assets/tabliodb-logo-stacked.svg" width="150">
  </picture>
</p>

<h3 align="center">Draw database diagrams, discuss schema changes, and export SQL — all in your browser. No terminal.</h3>

<p align="center">
  <a href="https://github.com/tabliodb/tabliodb/releases/latest"><img src="https://img.shields.io/github/v/release/tabliodb/tabliodb?style=for-the-badge&label=release" alt="Latest Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-green?style=for-the-badge" alt="License GPL-3.0" /></a>
  <a href="https://github.com/tabliodb/tabliodb/stargazers"><img src="https://img.shields.io/github/stars/tabliodb/tabliodb?style=for-the-badge" alt="GitHub stars" /></a>
</p>

<p align="center">
  <b>TablioDB is an open-source, fully self-hosted collaborative database schema design tool for engineering teams.</b> Build entity-relationship diagrams with an intuitive visual canvas. Catch schema issues early with built-in review signals, discuss changes via inline comments, and generate SQL migrations instantly. Real-time multiplayer, versioned snapshots, and zero-install browser access — designed for teams who take schema design seriously.
</p>

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
npm run db:seed
npm run dev:server
npm run dev:web
```

Server default: `http://localhost:4000`  
Web default: `http://localhost:5173`  
Realtime default: `ws://localhost:1234`  
PostgreSQL Docker default: `localhost:5433`
Redis Docker default: `localhost:6379`
Database UI default: `http://localhost:8080`

Seed development membuat akun dan workspace starter:

- Email: `owner@tabliodb.local`
- Password: `tabliodb-dev`
- Workspace: `Personal Workspace`
- Project: `Library System`
- Diagram: `Main schema`

Login Adminer:

- System: `PostgreSQL`
- Server: `database`
- Username: `postgres`
- Password: `postgres`
- Database: `tabliodb`

Redis dipakai untuk state ephemeral yang memang harus shared antar instance: rate limit REST dan Hocuspocus pub/sub realtime. Default development cukup memakai `REDIS_URL`; `TABLIODB_REALTIME_REDIS_URL` hanya perlu diisi jika realtime ingin diarahkan ke Redis terpisah.

Background worker aktif default lewat `TABLIODB_BACKGROUND_JOBS_ENABLED=true`. Job queue disimpan di PostgreSQL supaya durable saat container restart, sedangkan Redis tetap disiapkan untuk state ephemeral dan realtime fanout yang tidak boleh menjadi source of truth data penting.

Di PowerShell, salin env dengan:

```powershell
Copy-Item docker\example.env .env
```

## Production Self-Host

Production compose menjalankan satu container Tabliodb untuk API, frontend static build, realtime server, dan background worker. PostgreSQL dan Redis berjalan di network Docker internal dan tidak dipublish ke host secara default.

```bash
cp docker/example.prod.env docker/production.env
docker compose --env-file docker/production.env -f docker/docker-compose.prod.yml up -d --build
```

Di PowerShell:

```powershell
Copy-Item docker\example.prod.env docker\production.env
docker compose --env-file docker\production.env -f docker\docker-compose.prod.yml up -d --build
```

Setelah `docker/production.env` tersedia, command yang sama bisa dijalankan lewat:

```bash
npm run docker:prod:up
npm run docker:prod:logs
```

Setelah container sehat, buka URL sesuai `TABLIODB_PUBLIC_URL`. Fresh install akan masuk ke setup wizard untuk membuat owner pertama.

Hal yang wajib diganti sebelum server benar-benar dipakai:

- `POSTGRES_PASSWORD`: gunakan password kuat, jangan nilai contoh.
- `TABLIODB_PUBLIC_URL`: isi URL eksternal yang dipakai user, misalnya `https://tabliodb.example.com`.
- `TABLIODB_COOKIE_SECURE`: set `true` jika Tabliodb diakses lewat HTTPS.

Migration otomatis berjalan saat container Tabliodb start lewat `TABLIODB_RUN_MIGRATIONS=true`. Untuk deployment multi-replica nanti, jalankan migration hanya di satu job/container migrator lalu set replica app ke `TABLIODB_RUN_MIGRATIONS=false`.

Container app expose:

- HTTP API + web: `${TABLIODB_PORT:-4000}`
- Realtime Hocuspocus: `${TABLIODB_REALTIME_PORT:-1234}`

Frontend production otomatis mengarah ke realtime URL dengan hostname yang sama dan port `1234`, misalnya `wss://tabliodb.example.com:1234` saat halaman dibuka lewat HTTPS. Jika memakai reverse proxy, pastikan WebSocket Hocuspocus ikut diteruskan ke port realtime tersebut.

## Database Development

Gunakan migration biasa ketika hanya ingin menerapkan perubahan schema:

```bash
npm run db:migrate
```

Gunakan seed ketika ingin mengisi data starter tanpa menghapus data yang sudah ada:

```bash
npm run db:seed
```

Gunakan reset development ketika ingin database bersih dari awal:

```bash
npm run db:fresh
```

`db:fresh` menjalankan `db:reset` lalu `db:seed`. Reset hanya diizinkan otomatis untuk database lokal bernama `tabliodb` atau database dengan suffix `_dev`. Untuk environment disposable lain, set `TABLIODB_ALLOW_DB_RESET=true` secara eksplisit.

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
