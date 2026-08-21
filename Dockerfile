# Multi-stage build. The final image runs a single Node process that serves
# both the REST API and the built SPA, with SQLite embedded -- there is no
# second service to orchestrate.

# ---------------------------------------------------------------------------
# 1. Dependencies (cached independently of source changes)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Only the manifests, so this layer is reused whenever source changes but
# dependencies do not.
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/

# better-sqlite3 ships prebuilt binaries for linux-x64; on other architectures
# npm falls back to compiling, which needs a toolchain present.
RUN npm ci

# ---------------------------------------------------------------------------
# 2. Build both workspaces
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# 3. Runtime: production dependencies plus the compiled output
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/web/dist ./web/dist

# The SQLite file lives on a volume so data survives a container rebuild.
RUN mkdir -p /app/api/data && chown -R node:node /app/api/data
USER node

ENV PORT=4000
ENV DB_PATH=data/app.sqlite
EXPOSE 4000

# Reports unhealthy until the API is actually answering, so `docker compose up
# --wait` blocks until the app is genuinely ready rather than merely started.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "api/dist/index.js"]
