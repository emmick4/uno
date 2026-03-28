# CLAUDE.md — UNO Online

## Project Overview
Real-time multiplayer Uno card game with support for multiple gamemodes (Original Uno, Harry Potter Uno, more later). Built with React + Vite (frontend) and a Bun WebSocket server (backend). No database — all game state is ephemeral.

**Live at:** https://uno-one-olive.vercel.app
**WebSocket server:** https://uno-ws.ryanemmick.com

## Monorepo Structure
This is an npm workspaces monorepo with four packages:

- `packages/shared` (@uno/shared) — TypeScript types and constants shared between client and server. NO runtime dependencies. If you change types here, both client and server see the changes.
- `packages/gamemodes` (@uno/gamemodes) — Gamemode plugins (card decks, rule logic). Used by the server. The client only needs the type definitions from @uno/shared.
- `packages/server` (@uno/server) — Bun WebSocket server. All game logic runs here. The client is NOT authoritative.
- `packages/client` (@uno/client) — React + Vite frontend. Renders game state received from the server. Sends user intents (e.g., "play card X") to the server.

## Commands
- `npm run dev` — Start both client (port 3000) and server (port 1999) in parallel
- `npm run dev:client` — Start only the frontend
- `npm run dev:server` — Start only the Bun WebSocket server
- `npm run build` — Build all packages
- `npm run typecheck` — Type-check all packages

## Deployment

### Frontend (automatic)
The frontend auto-deploys to Vercel on every push to `master`. No action needed.

### Backend (manual — Ryan only)
The backend runs on Ryan's homelab Kubernetes cluster. When server code changes:
```bash
# From the repo root:
podman build -t ghcr.io/emmick4/uno-server:latest .
podman push ghcr.io/emmick4/uno-server:latest
kubectl rollout restart deployment/uno-server -n uno
```

Blake does NOT need to deploy the backend. If you change frontend-only code (anything in `packages/client/`), just push to `master` and Vercel handles it. If you change server code, tell Ryan and he'll deploy it.

### What triggers what on push to master:
- **Changes in `packages/client/`** — Vercel auto-deploys frontend. Done.
- **Changes in `packages/server/` or `packages/gamemodes/`** — Needs manual backend deploy by Ryan.
- **Changes in `packages/shared/`** — Both frontend and backend are affected. Vercel auto-deploys frontend; Ryan needs to manually deploy backend.

## Architecture Rules
1. **Server is authoritative.** The client NEVER computes game logic. It sends intents and renders the state the server sends back.
2. **Types live in @uno/shared.** Never duplicate type definitions between client and server.
3. **Gamemode logic lives in @uno/gamemodes.** To add a new gamemode, create a new folder in `packages/gamemodes/src/` implementing the `GamemodePlugin` interface. Register it in `packages/gamemodes/src/index.ts`.
4. **House rules are data, not code branches.** Each house rule is a boolean or number in the `HouseRules` type. The game engine checks these values. Some house rules also inject additional cards into the deck via `additionalCards`.
5. **No database.** All game state is ephemeral (in-memory on the server). Preferences (nickname, house rule picks) are stored in localStorage on the client.

## Working on the Frontend
If you're working on UI components, you only need to touch files in `packages/client/`.

### Key concepts:
- **Screens** are in `packages/client/src/screens/`. There are three: LandingScreen, LobbyScreen, GameScreen.
- **Components** go in `packages/client/src/components/`, organized by screen (landing/, lobby/, game/, shared/).
- **Game state** comes from the Zustand store in `packages/client/src/stores/game-store.ts`. Components read from this store using hooks. You don't need to understand the WebSocket protocol — the store is updated automatically.
- **Styling** uses Tailwind CSS v4. For complex layouts (the oval table), use CSS Modules in a co-located `.module.css` file.

### What you can safely change without breaking game logic:
- Any component's visual layout, styling, animations
- Component structure and composition
- Asset files (images, sounds)
- Tailwind classes
- Animation timings and effects

### What you should NOT change without coordination:
- Type definitions in `packages/shared/`
- The Zustand store structure
- WebSocket message handling in `useGameSocket.ts`
- Anything in `packages/server/` or `packages/gamemodes/`

## WebSocket Message Protocol
Messages between client and server are JSON with a `type` field. All types are defined in `packages/shared/src/types/messages.ts`.

- Client sends intents: `{ type: "playCard", cardId: "red-7-0" }`
- Server sends state: `{ type: "gameState", state: { ... } }`
- Server sends events: `{ type: "cardPlayed", playerId: "abc", card: { ... } }`

The client should handle events for animations FIRST, then apply the subsequent state update.

## Adding a New Gamemode
1. Create `packages/gamemodes/src/your-gamemode/` with: `index.ts`, `deck.ts`, `rules.ts`
2. Implement the `GamemodePlugin` interface (see `packages/shared/src/types/gamemode.ts`)
3. Export it from `packages/gamemodes/src/index.ts`
4. Add card assets in `packages/client/public/assets/cards/your-gamemode/`
5. Add a card in the GamemodeCarousel on the landing page

## Adding a New House Rule
1. Add the field to `HouseRules` in `packages/shared/src/types/house-rules.ts`
2. Add its default to `DEFAULT_HOUSE_RULES`
3. Add a `HouseRuleDefinition` entry to `UNIVERSAL_HOUSE_RULES` (or to a gamemode's `gamemodeHouseRules`)
4. If the rule adds cards to the deck, include `additionalCards` in the definition
5. Implement the rule's behavior in the game engine (`packages/server/src/engine/game-engine.ts`)

## Game Rules Reference

### Original Uno
- **Goal:** Run out of cards
- **Setup:** 7 cards each. Remaining deck in middle, one card flipped to start discard. If first discard is an action card, its effect applies to the first player.
- **Play:** Match color or number, or play a wild. Can't play? Draw one. If drawn card is playable, may play it.
- **UNO:** Call UNO when you have one card. If caught not calling, draw penalty cards. Don't have to call UNO to win.
- **Win:** Game ends immediately when a player has 0 cards.

### Harry Potter Uno
- Same base rules as Original, plus:
- **Draw 3** instead of Draw 2
- **Invisibility** — blocks any card effect, can be played out of turn
- **Howler** — lets you see another player's hand

## Environment
- Node.js 20+ / Bun 1.x
- npm 10+
- TypeScript strict mode
- React 19, Vite 6, Tailwind CSS v4
- Bun WebSocket server (backend)
- Framer Motion (card animations)
- Zustand (state management)
