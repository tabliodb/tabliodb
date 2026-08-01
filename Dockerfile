# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY e2e/package.json e2e/package.json
COPY packages/docs/package.json packages/docs/package.json
COPY packages/render/package.json packages/render/package.json
COPY packages/schema-core/package.json packages/schema-core/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/sql/package.json packages/sql/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev --workspaces --include-workspace-root

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    TABLIODB_HOST=0.0.0.0 \
    TABLIODB_PORT=4000 \
    TABLIODB_REALTIME_ENABLED=true \
    TABLIODB_REALTIME_PORT=1234 \
    TABLIODB_STORAGE_PATH=/data/uploads \
    TABLIODB_WEB_DIST_PATH=/app/apps/server/public

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules

COPY --from=build --chown=node:node /app/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/server/public

COPY --from=build --chown=node:node /app/packages/docs/package.json ./packages/docs/package.json
COPY --from=build --chown=node:node /app/packages/docs/dist ./packages/docs/dist
COPY --from=build --chown=node:node /app/packages/render/package.json ./packages/render/package.json
COPY --from=build --chown=node:node /app/packages/render/dist ./packages/render/dist
COPY --from=build --chown=node:node /app/packages/schema-core/package.json ./packages/schema-core/package.json
COPY --from=build --chown=node:node /app/packages/schema-core/dist ./packages/schema-core/dist
COPY --from=build --chown=node:node /app/packages/sdk/package.json ./packages/sdk/package.json
COPY --from=build --chown=node:node /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/packages/sql/package.json ./packages/sql/package.json
COPY --from=build --chown=node:node /app/packages/sql/dist ./packages/sql/dist
COPY --from=build --chown=node:node /app/packages/ui/package.json ./packages/ui/package.json
COPY --from=build --chown=node:node /app/packages/ui/dist ./packages/ui/dist

COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/tabliodb-entrypoint

RUN chmod +x /usr/local/bin/tabliodb-entrypoint \
    && mkdir -p /data/uploads \
    && chown -R node:node /data

USER node

EXPOSE 4000 1234

ENTRYPOINT ["tabliodb-entrypoint"]
CMD ["node", "apps/server/dist/main.js"]
