import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useGameSocket } from '../hooks/useGameSocket'
import { useGameStore } from '../stores/game-store'
import { PlayerHand } from '../components/game/PlayerHand'
import { OpponentHand } from '../components/game/OpponentHand'
import { DiscardPile } from '../components/game/DiscardPile'
import { DrawPile } from '../components/game/DrawPile'
import { TurnTimer } from '../components/game/TurnTimer'
import { UnoCallButton } from '../components/game/UnoCallButton'
import { GameOverOverlay } from '../components/game/GameOverOverlay'
import { ChatWindow } from '../components/game/ChatWindow'
import { HandRevealOverlay } from '../components/game/HandRevealOverlay'
import { InvisibilityButton } from '../components/game/InvisibilityButton'
import type { CardColor } from '@uno/shared'

/** Position opponents around the top half of an oval */
function getOpponentPositions(count: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < count; i++) {
    // Spread across the top arc
    const angle = Math.PI + (Math.PI * (i + 1)) / (count + 1)
    const x = 50 + 44 * Math.cos(angle)
    const y = 50 + 40 * Math.sin(angle)
    positions.push({ x, y })
  }
  return positions
}

export function GameScreen() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const { send } = useGameSocket(roomCode)
  const game = useGameStore((s) => s.game)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const connected = useGameStore((s) => s.connected)
  const [canPlayAfterDraw, setCanPlayAfterDraw] = useState(false)

  // Identify ourselves on every new WebSocket connection
  useEffect(() => {
    if (!connected) return
    const nickname = localStorage.getItem('uno-nickname') || 'Player'
    const storedPlayerId = sessionStorage.getItem(`uno-player-${roomCode}`) || undefined
    send({ type: 'join', nickname, playerId: storedPlayerId })
  }, [connected, roomCode, send])

  const isMyTurn = game
    ? game.players[game.currentPlayerIndex]?.id === myPlayerId
    : false

  const myPlayer = game?.players.find((p) => p.id === myPlayerId)
  const opponents = game?.players.filter((p) => p.id !== myPlayerId) || []
  const opponentPositions = getOpponentPositions(opponents.length)

  // UNO call — show button if I have 1 card and haven't called yet
  const showUnoButton =
    game?.unoCallWindow?.playerId === myPlayerId && !game?.unoCallWindow?.calledUno

  const handlePlayCard = useCallback(
    (cardId: string, chosenColor?: CardColor) => {
      send({ type: 'playCard', cardId, chosenColor })
      setCanPlayAfterDraw(false)
    },
    [send],
  )

  const handleDrawCard = useCallback(() => {
    send({ type: 'drawCard' })
    // The server will tell us via gameState if we can play the drawn card
    setCanPlayAfterDraw(true)
  }, [send])

  const handlePass = useCallback(() => {
    send({ type: 'pass' })
    setCanPlayAfterDraw(false)
  }, [send])

  const handleCallUno = useCallback(
    (targetPlayerId?: string) => {
      send({ type: 'callUno', targetPlayerId })
    },
    [send],
  )

  const handlePlayOutOfTurn = useCallback(
    (cardId: string) => {
      send({ type: 'playOutOfTurn', cardId })
    },
    [send],
  )

  const handleRematch = useCallback(() => {
    send({ type: 'rematch' })
  }, [send])

  const handleLeave = useCallback(() => {
    send({ type: 'leave' })
    useGameStore.getState().reset()
    navigate('/')
  }, [send, navigate])

  if (!game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 animate-pulse">
          {connected ? 'Loading game...' : 'Connecting...'}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col">
      {/* Room code */}
      <div className="absolute top-3 right-4 text-xs text-gray-600 font-mono z-10">
        {roomCode}
      </div>

      {/* Direction indicator */}
      <div className="absolute top-3 left-4 text-xs text-gray-600 z-10">
        {game.direction === 1 ? '\u27F3 Clockwise' : '\u27F2 Counter-clockwise'}
      </div>

      {/* Game table area */}
      <div className="flex-1 relative">
        {/* Oval table */}
        <div className="absolute inset-8 sm:inset-16">
          <div className="absolute inset-0 bg-green-900/20 rounded-[50%] border border-green-800/40" />

          {/* Center: discard + draw + timer */}
          <div className="absolute inset-0 flex items-center justify-center gap-6">
            <DrawPile
              count={game.drawPileCount}
              onClick={handleDrawCard}
              isMyTurn={isMyTurn}
            />
            <div className="flex flex-col items-center gap-3">
              <DiscardPile topCard={game.topDiscard} currentColor={game.currentColor} />
              {game.pendingDrawCount > 0 && (
                <div className="text-red-400 font-bold text-sm animate-pulse">
                  +{game.pendingDrawCount} pending!
                </div>
              )}
            </div>
            <TurnTimer
              turnStartedAt={game.turnStartedAt}
              turnTimeLimit={game.turnTimeLimit}
              isMyTurn={isMyTurn}
            />
          </div>

          {/* Opponents around the oval */}
          {opponents.map((opponent, i) => {
            const pos = opponentPositions[i]
            if (!pos) return null
            const isTheirTurn = game.players[game.currentPlayerIndex]?.id === opponent.id

            return (
              <div
                key={opponent.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <OpponentHand
                  nickname={opponent.nickname}
                  cardCount={opponent.handCount}
                  isCurrentTurn={isTheirTurn}
                  hasCalledUno={opponent.hasCalledUno}
                  isConnected={opponent.isConnected}
                  isEliminated={opponent.isEliminated}
                  finishPosition={opponent.finishPosition}
                  onCallUno={
                    opponent.handCount === 1 && !opponent.hasCalledUno
                      ? () => handleCallUno(opponent.id)
                      : undefined
                  }
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* My hand + UNO button at bottom */}
      <div className="relative z-10 pb-4 px-4">
        {/* Turn indicator */}
        <div className="text-center mb-2">
          {isMyTurn ? (
            <span className="text-yellow-400 font-semibold text-sm animate-pulse">
              Your turn!
            </span>
          ) : (
            <span className="text-gray-600 text-sm">
              {game.players[game.currentPlayerIndex]?.nickname}&apos;s turn
            </span>
          )}
        </div>

        <div className="flex items-end justify-center gap-4">
          <UnoCallButton onCallUno={() => handleCallUno()} show={!!showUnoButton} />
          <InvisibilityButton onPlayOutOfTurn={handlePlayOutOfTurn} />

          <PlayerHand
            cards={game.myHand}
            isMyTurn={isMyTurn}
            topDiscard={game.topDiscard}
            currentColor={game.currentColor}
            pendingDrawCount={game.pendingDrawCount}
            onPlayCard={handlePlayCard}
            onDrawCard={handleDrawCard}
            onPass={handlePass}
            canPlayAfterDraw={canPlayAfterDraw}
          />
        </div>

        {/* My info */}
        <div className="text-center mt-2 text-xs text-gray-500">
          {myPlayer?.nickname} — {game.myHand.length} cards
        </div>
      </div>

      {/* Chat */}
      <ChatWindow
        onSend={(text) => send({ type: 'chat', text })}
      />

      {/* Hand reveal overlay (Howler) */}
      <HandRevealOverlay />

      {/* Game over overlay */}
      {game.phase === 'finished' && (
        <GameOverOverlay
          standings={game.standings}
          players={game.players}
          onRematch={handleRematch}
          onLeave={handleLeave}
          rematchVotes={game.rematchVotes.length}
          totalPlayers={game.players.filter((p) => p.isConnected).length}
        />
      )}
    </div>
  )
}
