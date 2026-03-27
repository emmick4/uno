import type * as Party from 'partykit/server'

interface PublicGame {
  roomCode: string
  hostNickname: string
  gamemode: string
  playerCount: number
  maxPlayers: number
  createdAt: number
}

/**
 * Matchmaking party — single global room that tracks public games.
 * Game rooms notify this party when they create/start/end a public game.
 * Clients can query for available public games.
 */
export default class Matchmaking implements Party.Server {
  games: Map<string, PublicGame> = new Map()

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({
      type: 'publicGames',
      games: Array.from(this.games.values()),
    }))
  }

  onMessage(message: string, _sender: Party.Connection) {
    let msg: { type: string; [key: string]: unknown }
    try {
      msg = JSON.parse(message)
    } catch {
      return
    }

    switch (msg.type) {
      case 'registerGame': {
        const game = msg.game as PublicGame
        if (game?.roomCode) {
          this.games.set(game.roomCode, game)
          this.broadcastGames()
        }
        break
      }
      case 'updateGame': {
        const roomCode = msg.roomCode as string
        const updates = msg.updates as Partial<PublicGame>
        const existing = this.games.get(roomCode)
        if (existing && updates) {
          this.games.set(roomCode, { ...existing, ...updates })
          this.broadcastGames()
        }
        break
      }
      case 'removeGame': {
        const roomCode = msg.roomCode as string
        if (roomCode) {
          this.games.delete(roomCode)
          this.broadcastGames()
        }
        break
      }
    }
  }

  /** Also handle HTTP requests for the landing page to fetch public games */
  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === 'GET') {
      // Clean up stale games (older than 30 minutes)
      const now = Date.now()
      for (const [code, game] of this.games) {
        if (now - game.createdAt > 30 * 60 * 1000) {
          this.games.delete(code)
        }
      }

      return new Response(
        JSON.stringify({ games: Array.from(this.games.values()) }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response('Method not allowed', { status: 405 })
  }

  private broadcastGames() {
    this.room.broadcast(
      JSON.stringify({
        type: 'publicGames',
        games: Array.from(this.games.values()),
      }),
    )
  }
}
