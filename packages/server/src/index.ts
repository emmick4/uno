import { roomManager, type ConnectionData } from './room-manager'

const PORT = Number(process.env.PORT) || 1999

const server = Bun.serve<ConnectionData>({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url)

    // Health check
    if (url.pathname === '/health') {
      return new Response('ok')
    }

    // Matchmaking API — list public games
    if (url.pathname === '/api/public-games') {
      return new Response(JSON.stringify({ games: [] }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // WebSocket upgrade — extract room code from path: /ws/:roomCode
    const match = url.pathname.match(/^\/ws\/([A-Z0-9]+)$/i)
    if (match) {
      const roomCode = match[1].toUpperCase()
      const upgraded = server.upgrade(req, {
        data: {
          playerId: '',
          nickname: '',
          isHost: false,
          roomCode,
        },
      })
      if (upgraded) return undefined
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    return new Response('UNO Game Server', { status: 200 })
  },

  websocket: {
    open(ws) {
      roomManager.handleConnect(ws)
    },
    message(ws, message) {
      roomManager.handleMessage(ws, String(message))
    },
    close(ws) {
      roomManager.handleClose(ws)
    },
  },
})

console.log(`UNO game server listening on port ${PORT}`)
