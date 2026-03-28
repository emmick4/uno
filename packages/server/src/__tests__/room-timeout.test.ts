import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import type { ServerMessage, ClientMessage } from '@uno/shared'

const PORT = 19993

function send(ws: WebSocket, msg: ClientMessage) {
  ws.send(JSON.stringify(msg))
}

function connectPlayer(roomCode: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws/${roomCode}`)
    ws.addEventListener('open', () => resolve(ws))
    ws.addEventListener('error', (e) => reject(e))
  })
}

function collectUntil(
  ws: WebSocket,
  predicate: (msg: ServerMessage) => boolean,
  timeoutMs = 5000,
): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const msgs: ServerMessage[] = []
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timed out. Got: ${JSON.stringify(msgs.map(m => m.type))}`)) }, timeoutMs)
    function handler(event: MessageEvent) {
      const msg: ServerMessage = JSON.parse(event.data as string)
      msgs.push(msg)
      if (predicate(msg)) { cleanup(); resolve(msgs) }
    }
    function cleanup() { clearTimeout(timer); ws.removeEventListener('message', handler) }
    ws.addEventListener('message', handler)
  })
}

let server: ReturnType<typeof Bun.serve>
let roomManagerInstance: any

beforeAll(async () => {
  const { roomManager } = await import('../room-manager')
  roomManagerInstance = roomManager
  server = Bun.serve({
    port: PORT,
    fetch(req, srv) {
      const url = new URL(req.url)
      const match = url.pathname.match(/^\/ws\/([A-Z0-9]+)$/i)
      if (match) {
        const roomCode = match[1].toUpperCase()
        const upgraded = srv.upgrade(req, {
          data: { playerId: '', nickname: '', isHost: false, roomCode },
        })
        if (upgraded) return undefined
        return new Response('Upgrade failed', { status: 400 })
      }
      return new Response('Test server')
    },
    websocket: {
      open(ws: any) { roomManager.handleConnect(ws) },
      message(ws: any, message: any) { roomManager.handleMessage(ws, String(message)) },
      close(ws: any) { roomManager.handleClose(ws) },
    },
  })
})

afterAll(() => { server?.stop() })

describe('room timeouts', () => {
  test('room tracks lastActivityAt on messages', async () => {
    const room = 'TIMETRACK'
    const ws = await connectPlayer(room)
    send(ws, { type: 'join', nickname: 'Alice' })
    await collectUntil(ws, (m) => m.type === 'welcome')

    const roomState = roomManagerInstance.rooms.get(room)
    expect(roomState).toBeDefined()
    expect(roomState.lastActivityAt).toBeGreaterThan(0)
    expect(roomState.createdAt).toBeGreaterThan(0)
    expect(roomState.lastActivityAt).toBeGreaterThanOrEqual(roomState.createdAt)

    ws.close()
  })

  test('room has createdAt set on creation', async () => {
    const before = Date.now()
    const ws = await connectPlayer('TIMECREATE')
    send(ws, { type: 'join', nickname: 'Bob' })
    await collectUntil(ws, (m) => m.type === 'welcome')
    const after = Date.now()

    const roomState = roomManagerInstance.rooms.get('TIMECREATE')
    expect(roomState.createdAt).toBeGreaterThanOrEqual(before)
    expect(roomState.createdAt).toBeLessThanOrEqual(after)

    ws.close()
  })
})
