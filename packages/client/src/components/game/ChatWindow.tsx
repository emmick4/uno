import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../../stores/game-store'

interface ChatWindowProps {
  onSend: (text: string) => void
}

export function ChatWindow({ onSend }: ChatWindowProps) {
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatMessages = useGameStore((s) => s.chatMessages)
  const myPlayerId = useGameStore((s) => s.myPlayerId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  return (
    <div className="absolute bottom-4 left-4 z-20">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-400 transition-colors"
      >
        {isOpen ? 'Hide Chat' : 'Chat'}
        {chatMessages.length > 0 && !isOpen && (
          <span className="ml-1 px-1.5 py-0.5 bg-blue-600 rounded-full text-[10px] text-white">
            {chatMessages.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="w-72 h-56 bg-gray-800/90 backdrop-blur rounded-xl border border-gray-700 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 text-sm">
            {chatMessages.length === 0 && (
              <div className="text-gray-600 text-xs">No messages yet</div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={msg.playerId === myPlayerId ? 'text-blue-400' : ''}>
                <span className="font-semibold text-xs">
                  {msg.playerId === myPlayerId ? 'You' : msg.nickname}:
                </span>{' '}
                <span className="text-gray-300 text-xs" style={{ fontFamily: 'UnoHandwritten, sans-serif' }}>{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-gray-700">
            <div className="flex gap-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                maxLength={200}
                className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs focus:outline-none focus:border-gray-500"
                style={{ fontFamily: 'UnoHandwritten, sans-serif' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
