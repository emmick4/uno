FROM docker.io/oven/bun:1 AS base
WORKDIR /app

# Copy all package files for workspace resolution
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/gamemodes/package.json packages/gamemodes/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install deps (bun handles workspaces)
RUN bun install

# Copy source (only what the server needs)
COPY packages/shared/ packages/shared/
COPY packages/gamemodes/ packages/gamemodes/
COPY packages/server/ packages/server/
COPY tsconfig.base.json tsconfig.json ./

# Run as non-root
USER bun
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "packages/server/src/index.ts"]
