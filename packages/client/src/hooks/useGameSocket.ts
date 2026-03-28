import { useEffect, useRef, useCallback } from 'react'
import type { ClientMessage, ServerMessage } from '@uno/shared'
import { useGameStore } from '../stores/game-store'

function getWsUrl(roomCode: string): string {
  const wsHost = import.meta.env.VITE_WS_HOST
  if (wsHost) {
    const protocol = wsHost.includes('localhost') ? 'ws' : 'wss'
    return `${protocol}://${wsHost}/ws/${roomCode}`
  }
  // Default: same origin (works when served from the Bun server)
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/${roomCode}`
}

export function useGameSocket(roomCode: string | undefined) {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setConnected, handleServerMessage } = useGameStore()

  useEffect(() => {
    if (!roomCode) return

    let closed = false

    function connect() {
      if (closed) return

      const socket = new WebSocket(getWsUrl(roomCode!))

      socket.addEventListener('open', () => {
        setConnected(true)
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
        // Auto-reconnect after 2 seconds
        if (!closed) {
          reconnectTimer.current = setTimeout(connect, 2000)
        }
      })

      socket.addEventListener('error', () => {
        socket.close()
      })

      socketRef.current = socket
    }

    connect()

    return () => {
      closed = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      socketRef.current?.close()
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
