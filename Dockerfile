# syntax=docker/dockerfile:1

# OXWeb Prices — production image.
#
# Two things are built from one dependency tree:
#
#   runner   the Next.js standalone application image
#   refresh  a one-shot container that reruns the provider adapters and
#            rewrites data/prices.json
#
# The site reads data/prices.json from its working directory at request time
# (see src/lib/dataset.ts), so both targets agree on /app/data and the compose
# file mounts the host dataset there.

# ---------------------------------------------------------------- dependencies
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------- build
FROM deps AS build
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the bundle by `next build`, so this has
# to be a build argument rather than a runtime environment variable.
ARG NEXT_PUBLIC_OXWEB_URL=https://oxweb.xyz
ENV NEXT_PUBLIC_OXWEB_URL=${NEXT_PUBLIC_OXWEB_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY . .
RUN npm run build

# --------------------------------------------------------------------- runner
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `output: 'standalone'` emits server.js plus only the traced node_modules.
# Static assets and the dataset are not traced, so they are copied explicitly.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/data ./data

# The page revalidates every 5 minutes and writes the regenerated HTML into
# .next/cache, so the unprivileged user needs to own it.
RUN mkdir -p .next/cache && chown -R node:node .next

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://$(hostname):${PORT:-3000}/" || exit 1

CMD ["node", "server.js"]

# -------------------------------------------------------------------- refresh
# Runs `npm run refresh-prices` against the mounted dataset. It keeps the full
# dependency tree because the refresh command is TypeScript executed by tsx.
FROM deps AS refresh
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
CMD ["npm", "run", "refresh-prices"]
