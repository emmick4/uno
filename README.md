# UNO Online

Real-time multiplayer Uno card game with multiple gamemodes.

## Quick Start

```bash
npm install
npm run dev
```

Opens the client at http://localhost:3000 and PartyKit server at http://localhost:1999.

## Gamemodes

- **Original Uno** — classic 108-card deck
- **Harry Potter Uno** — Invisibility blocks, Howler reveals hands, Draw 3

## Deploy

```bash
# Deploy PartyKit server
npm run deploy:server

# Deploy Vercel frontend (set VITE_PARTYKIT_HOST env var first)
npm run deploy:client
```

## Structure

- `packages/shared` — shared TypeScript types
- `packages/gamemodes` — pluggable card game logic
- `packages/server` — PartyKit WebSocket server
- `packages/client` — React + Vite frontend
