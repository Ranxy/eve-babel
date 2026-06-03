import { useEffect, useRef, useState } from 'react'

import type { ChatMessage } from '../../shared/types'
import { buildChannelStateKey, useAppStore } from '../store/appStore'

interface OverlayViewProps {
  channelName: string
}

export function OverlayView({ channelName }: OverlayViewProps) {
  const { state, actions } = useAppStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const feedRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)

  const selectedCharacterId = state.config.selectedCharacterId

  useEffect(() => {
    if (!selectedCharacterId) {
      return
    }

    void actions.loadChannelMessages(channelName)
  }, [actions, channelName, selectedCharacterId])

  useEffect(() => {
    if (!selectedCharacterId) {
      return
    }

    const key = buildChannelStateKey(selectedCharacterId, channelName)
    const pageMessages = state.channelMessages[key]?.messages ?? []
    const mergedMessages = mergeMessages(pageMessages, state.recentMessages.filter(
      (m) => m.characterId === selectedCharacterId && m.channelName === channelName
    ))

    setMessages(mergedMessages)
  }, [channelName, selectedCharacterId, state.channelMessages, state.recentMessages])

  useEffect(() => {
    const container = feedRef.current
    if (!container || !shouldAutoScrollRef.current) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [messages])

  const handleScroll = () => {
    const container = feedRef.current
    if (!container) {
      return
    }

    shouldAutoScrollRef.current = isNearBottom(container)
  }

  const selectedCharacter = state.characters.find((c) => c.characterId === selectedCharacterId) ?? null
  const chatMessages = messages.filter((m) => m.messageType === 'chat')

  return (
    <div className="overlay-body">
      <div className="overlay-message-feed" onScroll={handleScroll} ref={feedRef}>
        {chatMessages.length === 0 ? (
          <div className="overlay-empty">Waiting for messages…</div>
        ) : (
          chatMessages.map((message) => {
            const hasTranslation = !!message.translatedText
            const isSelf = selectedCharacter?.label != null && message.senderName === selectedCharacter.label

            return (
              <div
                className={`overlay-message ${isSelf ? 'overlay-message-self' : ''}`}
                key={message.messageId}
              >
                <div className="overlay-message-header">
                  <span className="overlay-sender">{message.senderName}</span>
                  <span className="overlay-time">{formatOverlayTime(message.timestamp)}</span>
                </div>
                {hasTranslation ? (
                  <>
                    <div className="overlay-message-translated">{message.translatedText}</div>
                    <div className="overlay-message-original">{message.messageText}</div>
                  </>
                ) : (
                  <div className="overlay-message-original">{message.messageText}</div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function isNearBottom(container: HTMLDivElement): boolean {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= 32
}

function formatOverlayTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function mergeMessages(pageMessages: ChatMessage[], recentMessages: ChatMessage[]): ChatMessage[] {
  if (recentMessages.length === 0 && pageMessages.length > 0) {
    return pageMessages
  }

  const map = new Map<string, ChatMessage>()

  for (const message of pageMessages) {
    map.set(message.messageId, message)
  }

  for (const message of recentMessages) {
    map.set(message.messageId, message)
  }

  return Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-200)
}
