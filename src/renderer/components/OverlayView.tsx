import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatMessage } from '../../shared/types'
import { buildChannelStateKey, useAppStore } from '../store/appStore'

interface OverlayViewProps {
  channelName: string
}

export function OverlayView({ channelName }: OverlayViewProps) {
  const { state, actions } = useAppStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isOpaque, setIsOpaque] = useState(true)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const resizeStartY = useRef<number | null>(null)

  const selectedCharacterId = state.config.selectedCharacterId

  useEffect(() => {
    document.documentElement.style.background = '#f0f2f6'
    document.body.style.background = '#f0f2f6'
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.background = ''
      document.body.style.background = ''
      document.body.style.margin = ''
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (isOpaque) {
      document.documentElement.style.background = '#f0f2f6'
      document.body.style.background = '#f0f2f6'
    } else {
      document.documentElement.style.background = 'transparent'
      document.body.style.background = 'transparent'
    }
  }, [isOpaque])

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

  const handleClose = useCallback(() => {
    void window.eveBabel.closeOverlayWindow()
  }, [])

  const handleResizeMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    resizeStartY.current = event.screenY

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (resizeStartY.current === null) {
        return
      }

      const deltaY = moveEvent.screenY - resizeStartY.current
      resizeStartY.current = moveEvent.screenY
      void window.eveBabel.resizeOverlayBody(deltaY)
    }

    const handleMouseUp = () => {
      resizeStartY.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  const selectedCharacter = state.characters.find((c) => c.characterId === selectedCharacterId) ?? null
  const chatMessages = messages.filter((m) => m.messageType === 'chat')

  return (
    <div className={`overlay-window ${isOpaque ? 'overlay-window-opaque' : ''}`}>
      <div className="overlay-header">
        <div className="overlay-header-drag">
          <span className="overlay-header-channel">{channelName}</span>
        </div>
        <div className="overlay-header-actions">
          <button
            aria-label={isOpaque ? 'Switch to transparent' : 'Switch to opaque'}
            className="overlay-header-btn"
            onClick={() => setIsOpaque((v) => !v)}
            title={isOpaque ? 'Switch to transparent mode' : 'Switch to opaque mode'}
            type="button"
          >
            {isOpaque ? '◉' : '◌'}
          </button>
          <button
            aria-label="Close overlay"
            className="overlay-header-btn overlay-header-close"
            onClick={handleClose}
            title="Close overlay"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="overlay-feed" onScroll={handleScroll} ref={feedRef}>
        {chatMessages.length === 0 ? (
          <div className="overlay-empty">Waiting for messages…</div>
        ) : (
          chatMessages.map((message) => {
            const hasTranslation = !!message.translatedText
            const isSelf = selectedCharacter?.label != null && message.senderName === selectedCharacter.label

            return (
              <div
                className={`overlay-msg ${isSelf ? 'overlay-msg-self' : ''}`}
                key={message.messageId}
              >
                <div className="overlay-msg-meta">
                  <span className="overlay-msg-sender">{message.senderName}</span>
                  <span className="overlay-msg-time">{formatOverlayTime(message.timestamp)}</span>
                </div>
                {hasTranslation ? (
                  <>
                    <div className="overlay-msg-translated">{message.translatedText}</div>
                    <div className="overlay-msg-original">{message.messageText}</div>
                  </>
                ) : (
                  <div className="overlay-msg-original">{message.messageText}</div>
                )}
              </div>
            )
          })
        )}
      </div>
      <div
        className="overlay-resize-handle"
        onMouseDown={handleResizeMouseDown}
      />
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
