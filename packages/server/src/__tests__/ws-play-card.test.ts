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

      // Card was played successfully — we got cardPlayed + gameState
      expect(newGameState?.type).toBe('gameState')
    }

    ws1.close()
    ws2.close()
  })

  test('new connection can rejoin mid-game and play cards', async () => {
    const room = 'TESTRECON'

    const ws1 = await connectPlayer(room)
    const ws2 = await connectPlayer(room)

    const id1 = await joinAndGetId(ws1, 'Alice')
    const id2 = await joinAndGetId(ws2, 'Bob')
    await collectUntil(ws1, (m) => m.type === 'lobbyState')

    // Start game
    send(ws1, { type: 'startGame' })
    const gs1 = await collectUntil(ws1, (m) => m.type === 'gameState')
    await collectUntil(ws2, (m) => m.type === 'gameState')

    const gameState = gs1.find(m => m.type === 'gameState')!
    if (gameState.type !== 'gameState') throw new Error('no gameState')
    const currentPlayerId = gameState.state.players[gameState.state.currentPlayerIndex].id
    const isP1Turn = currentPlayerId === id1

    // Simulate what the client does: close socket, open a NEW one (like navigating to GameScreen)
    const oldWs = isP1Turn ? ws1 : ws2
    const playerId = isP1Turn ? id1 : id2
    oldWs.close()

    // Wait a beat for close to process
    await new Promise(r => setTimeout(r, 100))

    // New connection — ws.data.playerId is '' on server
    const newWs = await connectPlayer(room)

    // THIS is the bug scenario: if we don't rejoin, playCard fails with "Player not found"
    // because ws.data.playerId is still ''

    // Send join with stored playerId (like the client does)
    send(newWs, { type: 'join', nickname: 'Alice', playerId })
    const rejoinMsgs = await collectUntil(newWs, (m) => m.type === 'gameState')
    const welcome = rejoinMsgs.find(m => m.type === 'welcome')
    expect(welcome).toBeDefined()

    // Now find a playable card and try to play it
    const gs = rejoinMsgs.find(m => m.type === 'gameState')!
    if (gs.type !== 'gameState') throw new Error('no gameState')

    const playable = gs.state.myHand.find((card) => {
      if (card.color === 'wild') return true
      if (card.color === gs.state.currentColor) return true
      if (card.value === gs.state.topDiscard.value) return true
      return false
    })

    if (playable) {
      const chosenColor = playable.color === 'wild' ? 'red' as const : undefined
      send(newWs, { type: 'playCard', cardId: playable.id, chosenColor })
      const result = await collectUntil(newWs, (m) => m.type === 'gameState' || m.type === 'error')
      const err = result.find(m => m.type === 'error')
      // Should NOT get "Player not found"
      expect(err).toBeUndefined()
    }

    newWs.close()
    ;(isP1Turn ? ws2 : ws1).close()
  })

  test('wild-draw4 color change is reflected in both players game state', async () => {
    const room = 'TESTWILD'

    const ws1 = await connectPlayer(room)
    const ws2 = await connectPlayer(room)

    const id1 = await joinAndGetId(ws1, 'Alice')
    const id2 = await joinAndGetId(ws2, 'Bob')
    await collectUntil(ws1, (m) => m.type === 'lobbyState')

    send(ws1, { type: 'startGame' })
    const gs1Msgs = await collectUntil(ws1, (m) => m.type === 'gameState')
    const gs2Msgs = await collectUntil(ws2, (m) => m.type === 'gameState')

    const gs1 = gs1Msgs.find(m => m.type === 'gameState')!
    const gs2 = gs2Msgs.find(m => m.type === 'gameState')!
    if (gs1.type !== 'gameState' || gs2.type !== 'gameState') throw new Error('no gameState')

    // Both players should see the same currentColor
    expect(gs1.state.currentColor).toBe(gs2.state.currentColor)

    // Find whose turn it is and give them a wild-draw4
    const currentId = gs1.state.players[gs1.state.currentPlayerIndex].id
    const isP1Turn = currentId === id1
    const currentWs = isP1Turn ? ws1 : ws2
    const otherWs = isP1Turn ? ws2 : ws1

    // Find a wild card in hand, or just play any card to verify color flow
    const myHand = (isP1Turn ? gs1 : gs2).state.myHand
    const wildCard = myHand.find(c => c.color === 'wild')

    if (wildCard) {
      send(currentWs, { type: 'playCard', cardId: wildCard.id, chosenColor: 'green' })

      // Both players should get updated game state
      const p1Update = await collectUntil(currentWs, (m) => m.type === 'gameState')
      const p2Update = await collectUntil(otherWs, (m) => m.type === 'gameState')

      const p1State = p1Update.find(m => m.type === 'gameState')!
      const p2State = p2Update.find(m => m.type === 'gameState')!

      if (p1State.type === 'gameState' && p2State.type === 'gameState') {
        // BOTH players must see currentColor as green
        expect(p1State.state.currentColor).toBe('green')
        expect(p2State.state.currentColor).toBe('green')
        // pendingDrawCount should be 0 (draws already applied)
        expect(p1State.state.pendingDrawCount).toBe(0)
        expect(p2State.state.pendingDrawCount).toBe(0)
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
