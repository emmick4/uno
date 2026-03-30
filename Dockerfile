FROM docker.io/oven/bun:1 AS base
LABEL org.opencontainers.image.source=https://github.com/emmick4/uno
WORKDIR /app

# Copy all package files for workspace resolution
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/gamemodes/package.json packages/gamemodes/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install deps (bun handles workspaces)
RUN bun install

# Copy all source
COPY packages/shared/ packages/shared/
COPY packages/gamemodes/ packages/gamemodes/
COPY packages/server/ packages/server/
COPY packages/client/ packages/client/
COPY tsconfig.base.json tsconfig.json ./

# Build the frontend
RUN cd packages/client && bunx --bun vite build

# Run as non-root
USER bun
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "packages/server/src/index.ts"]
