import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import type { ServerMessage, ClientMessage } from '@uno/shared'

const PORT = 19991
let server: ReturnType<typeof Bun.serve>

/** Collect messages from a WebSocket until a predicate matches or timeout */
function collectUntil(
  ws: WebSocket,
  predicate: (msg: ServerMessage) => boolean,
  timeoutMs = 5000,
): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const msgs: ServerMessage[] = []
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting. Got ${msgs.length} messages: ${JSON.stringify(msgs.map(m => m.type))}`))
    }, timeoutMs)

    function handler(event: MessageEvent) {
      const msg: ServerMessage = JSON.parse(event.data as string)
      msgs.push(msg)
      if (predicate(msg)) {
        cleanup()
        resolve(msgs)
      }
    }

    function cleanup() {
      clearTimeout(timer)
      ws.removeEventListener('message', handler)
    }

    ws.addEventListener('message', handler)
  })
}

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

async function joinAndGetId(ws: WebSocket, nickname: string): Promise<string> {
  send(ws, { type: 'join', nickname })
  const msgs = await collectUntil(ws, (m) => m.type === 'welcome')
  const welcome = msgs.find((m) => m.type === 'welcome')!
  if (welcome.type !== 'welcome') throw new Error('Expected welcome')
  return welcome.playerId
}

// Import the server module to start it on our test port
beforeAll(async () => {
  // We start a minimal server using the same room manager
  const { roomManager } = await import('../room-manager')
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

afterAll(() => {
  server?.stop()
})

describe('WebSocket play card flow', () => {
  test('two players can join, host starts game, current player can play a card', async () => {
    const room = 'TESTPLAY'

    // Connect two players
    const ws1 = await connectPlayer(room)
    const ws2 = await connectPlayer(room)

    const id1 = await joinAndGetId(ws1, 'Alice')
    const id2 = await joinAndGetId(ws2, 'Bob')

    // Wait for lobby state to settle
    await collectUntil(ws1, (m) => m.type === 'lobbyState')

    // Host starts game
    send(ws1, { type: 'startGame' })

    // Both should receive gameStarted + gameState
    const p1Msgs = await collectUntil(ws1, (m) => m.type === 'gameState')
    const gameState1 = p1Msgs.find((m) => m.type === 'gameState')
    expect(gameState1).toBeDefined()
    if (gameState1?.type !== 'gameState') throw new Error('Expected gameState')

    // Also collect p2's game state
    const p2Msgs = await collectUntil(ws2, (m) => m.type === 'gameState')
    const gameState2 = p2Msgs.find((m) => m.type === 'gameState')
    expect(gameState2).toBeDefined()
    if (gameState2?.type !== 'gameState') throw new Error('Expected gameState')

    // Figure out whose turn it is
    const currentPlayerId = gameState1.state.players[gameState1.state.currentPlayerIndex].id
    const isP1Turn = currentPlayerId === id1
    const currentWs = isP1Turn ? ws1 : ws2
    const currentState = isP1Turn ? gameState1.state : gameState2.state

    // Find a playable card in the current player's hand
    const topDiscard = currentState.topDiscard
    const currentColor = currentState.currentColor
    const myHand = currentState.myHand

    const playable = myHand.find((card) => {
      if (card.color === 'wild') return true
      if (card.color === currentColor) return true
      if (card.value === topDiscard.value) return true
      return false
    })

    if (!playable) {
      // No playable card — draw instead, which is also a valid action
      send(currentWs, { type: 'drawCard' })
      const drawMsgs = await collectUntil(currentWs, (m) => m.type === 'gameState')
      const newState = drawMsgs.find(m => m.type === 'gameState')
      expect(newState).toBeDefined()
    } else {
      // Play the card
      const chosenColor = playable.color === 'wild' ? 'red' : undefined
      send(currentWs, { type: 'playCard', cardId: playable.id, chosenColor })

      // Should receive cardPlayed event + new gameState
      const playMsgs = await collectUntil(currentWs, (m) => m.type === 'gameState')
      const cardPlayed = playMsgs.find((m) => m.type === 'cardPlayed')
      const newGameState = playMsgs.find((m) => m.type === 'gameState')

      expect(cardPlayed).toBeDefined()
      expect(newGameState).toBeDefined()

      if (newGameState?.type === 'gameState') {
        // Turn should have advanced (unless player won)
        if (newGameState.state.phase === 'playing') {
          expect(newGameState.state.players[newGameState.state.currentPlayerIndex].id).not.toBe(currentPlayerId)
        }
      }
    }

    ws1.close()
    ws2.close()
  })

  test('playing a card with wrong id returns error', async () => {
    const room = 'TESTERR'

    const ws1 = await connectPlayer(room)
    const ws2 = await connectPlayer(room)

    await joinAndGetId(ws1, 'Alice')
    await joinAndGetId(ws2, 'Bob')
    await collectUntil(ws1, (m) => m.type === 'lobbyState')

    send(ws1, { type: 'startGame' })
    await collectUntil(ws1, (m) => m.type === 'gameState')
    await collectUntil(ws2, (m) => m.type === 'gameState')

    // Try to play a nonexistent card
    send(ws1, { type: 'playCard', cardId: 'fake-card-id' })
    const errMsgs = await collectUntil(ws1, (m) => m.type === 'error')
    const err = errMsgs.find((m) => m.type === 'error')
    expect(err).toBeDefined()

    ws1.close()
    ws2.close()
  })
})
