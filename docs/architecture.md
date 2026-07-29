# Architecture

Tabliodb mengikuti pola monorepo aplikasi besar seperti Immich: root repository dibuat tipis, sedangkan tanggung jawab teknis dipisahkan ke app dan package yang jelas.

## Backend

`apps/server` memakai NestJS, Kysely, PostgreSQL, dan Hocuspocus. Layer backend disusun horizontal:

- `controllers`: HTTP route boundary.
- `services`: orchestration dan domain use case.
- `repositories`: akses database dan integrasi sistem.
- `dtos`: Zod DTO untuk request/response.
- `schema`: typed DB model dan migrations.
- `realtime`: Hocuspocus/Yjs document lifecycle.
- `middleware`: auth guard, filters, interceptors.

## Collaboration Model

Realtime diagram document disimpan sebagai Yjs update state di `diagram_documents`. Presence tidak dipersist ke database; presence tetap ephemeral melalui Yjs awareness.

## Canonical Schema Model

`packages/schema-core` adalah pusat model database design. UI, realtime document mapper, SQL generator, importer, snapshots, dan SDK harus berbicara melalui model ini agar rename table/column tidak merusak relationship.
