import { useEffect, useRef, useCallback } from 'react'
import PartySocket from 'partysocket'
import type { ClientMessage, ServerMessage } from '@uno/shared'
import { useGameStore } from '../stores/game-store'

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999'

export function useGameSocket(roomCode: string | undefined) {
  const socketRef = useRef<PartySocket | null>(null)
  const { setConnected, handleServerMessage } = useGameStore()

  useEffect(() => {
    if (!roomCode) return

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode,
      party: 'main',
    })

    socket.addEventListener('open', () => {
      setConnected(true)
      // If we have a stored player ID, attempt to rejoin
      const myPlayerId = useGameStore.getState().myPlayerId
      if (myPlayerId) {
        const nickname = localStorage.getItem('uno-nickname') || 'Player'
        socket.send(JSON.stringify({ type: 'join', nickname }))
      }
    })

    socket.addEventListener('message', (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)
        handleServerMessage(msg)
      } catch {
        console.error('Failed to parse server message:', event.data)
      }
    })

    socket.addEventListener('close', () => {
      setConnected(false)
    })

    socketRef.current = socket

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [roomCode, setConnected, handleServerMessage])

  const send = useCallback((msg: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { send }
}
