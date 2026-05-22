import { useEffect, useRef, useState } from 'react'

import type { ChatMessage, ChannelSummary } from '../../shared/types'

interface MessageFeedProps {
  hasMoreHistory: boolean
  isLoadingMessages: boolean
  messages: ChatMessage[]
  onLoadOlder: () => void
  channels: ChannelSummary[]
  portraits: Record<string, string>
  selectedChannelName: string | null
  selectedCharacterLabel: string | null
}

export function MessageFeed(props: MessageFeedProps) {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const messageFeedRef = useRef<HTMLDivElement | null>(null)
  const previousChannelRef = useRef<string | null>(null)
  const previousEdgeIdsRef = useRef<{ firstId: string | null; lastId: string | null }>({ firstId: null, lastId: null })
  const historyAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)
  const selectedChannel = props.channels.find((channel) => channel.channelName === props.selectedChannelName) ?? null
  const visibleMessages = props.selectedChannelName ? props.messages : []

  useEffect(() => {
    const container = messageFeedRef.current
    if (!container) {
      return
    }

    const firstId = visibleMessages[0]?.messageId ?? null
    const lastId = visibleMessages.at(-1)?.messageId ?? null
    const channelChanged = previousChannelRef.current !== props.selectedChannelName

    if (channelChanged) {
      previousChannelRef.current = props.selectedChannelName
      previousEdgeIdsRef.current = { firstId, lastId }

      if (props.selectedChannelName && visibleMessages.length > 0) {
        container.scrollTop = container.scrollHeight
      }

      return
    }

    if (historyAnchorRef.current) {
      const anchor = historyAnchorRef.current
      historyAnchorRef.current = null
      container.scrollTop = anchor.scrollTop + (container.scrollHeight - anchor.scrollHeight)
      previousEdgeIdsRef.current = { firstId, lastId }
      return
    }

    const appendedNewMessage = previousEdgeIdsRef.current.lastId !== null && previousEdgeIdsRef.current.lastId !== lastId

    if (appendedNewMessage && isNearBottom(container)) {
      container.scrollTop = container.scrollHeight
    }

    previousEdgeIdsRef.current = { firstId, lastId }
  }, [props.selectedChannelName, visibleMessages])

  const handleScroll = () => {
    const container = messageFeedRef.current
    if (!container) {
      return
    }

    setShowScrollToBottom(!isNearBottom(container))

    if (!props.hasMoreHistory || props.isLoadingMessages || visibleMessages.length === 0) {
      return
    }

    if (container.scrollTop > 48) {
      return
    }

    historyAnchorRef.current = {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop
    }
    props.onLoadOlder()
  }

  const handleScrollToBottom = () => {
    const container = messageFeedRef.current
    if (!container) {
      return
    }
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }

  return (
    <section className="panel message-panel message-panel-root">
      <div className="panel-header message-panel-header">
        <div>
          <div className="eyebrow">Conversation</div>
          <h2>{selectedChannel?.channelName ?? 'Choose a channel'}</h2>
          {selectedChannel ? (
            <p className="conversation-subtitle">
              {selectedChannel.enabled ? 'New arrivals are queued into live translation.' : 'This route is visible but translation is currently muted.'}
            </p>
          ) : null}
          <div className="conversation-meta-row">
            {props.selectedCharacterLabel ? <span className="chip chip-neutral">{props.selectedCharacterLabel}</span> : null}
            {selectedChannel ? (
              <span className={`chip ${selectedChannel.enabled ? 'chip-ok' : 'chip-neutral'}`}>
                {selectedChannel.enabled ? 'Translation live' : 'Translation muted'}
              </span>
            ) : null}
          </div>
        </div>
        <div className="message-panel-summary">
          <span className="message-panel-count">{visibleMessages.length}</span>
          <span className="status-label">messages</span>
        </div>
      </div>
      <div className="message-feed chat-thread" onScroll={handleScroll} ref={messageFeedRef}>
        {!props.selectedChannelName ? (
          <div className="empty-state">Select a channel on the left to open its conversation stream.</div>
        ) : props.isLoadingMessages && visibleMessages.length === 0 ? (
          <div className="empty-state">Loading cached messages…</div>
        ) : visibleMessages.length === 0 ? (
          <div className="empty-state">This channel has no cached messages yet.</div>
        ) : (
          <>
            <div className="history-indicator">
              {props.isLoadingMessages
                ? 'Loading earlier cached messages…'
                : props.hasMoreHistory
                  ? 'Scroll upward to load earlier messages.'
                  : 'Reached the start of cached history.'}
            </div>
            {visibleMessages.map((message) => {
              const showTranslation = shouldShowTranslation(message)
              const showTranslationStatus = selectedChannel?.enabled === true && message.messageType === 'chat'

              const hasTranslation = !!message.translatedText
              const showSecondBubble = !hasTranslation && showTranslation

              return (
                <article
                  className={`chat-message ${resolveMessageTone(message, props.selectedCharacterLabel)}`}
                  key={message.messageId}
                >
                  <div className="chat-message-meta">
                    <span className="chat-sender-group">
                      {message.messageType === 'chat' && (
                        props.portraits[message.senderName] ? (
                          <img
                            alt={message.senderName}
                            className="chat-avatar"
                            loading="lazy"
                            src={props.portraits[message.senderName]}
                          />
                        ) : (
                          <span aria-hidden="true" className="chat-avatar chat-avatar-placeholder">
                            {message.senderName.charAt(0).toUpperCase()}
                          </span>
                        )
                      )}
                      <span className="chat-sender">{message.senderName}</span>
                    </span>
                    <span>{formatTime(message.timestamp)}</span>
                  </div>
                  <div className="chat-bubble-stack">
                    <div className={`chat-bubble ${hasTranslation ? 'chat-bubble-translated' : 'chat-bubble-original'}`}>
                      <div className="chat-bubble-body">
                        {hasTranslation ? (
                          <>
                            <div className="chat-bubble-copy translation-face">{message.translatedText}</div>
                            <div className="chat-bubble-copy original-face">{message.messageText}</div>
                          </>
                        ) : (
                          <div className="chat-bubble-copy">{message.messageText}</div>
                        )}
                        {showTranslationStatus ? (
                          <span
                            aria-label={resolveTranslationIndicatorLabel(message.translationStatus)}
                            className={`translation-indicator ${resolveTranslationIndicatorTone(message.translationStatus)}`}
                            title={resolveTranslationIndicatorLabel(message.translationStatus)}
                          />
                        ) : null}
                      </div>
                    </div>
                    {showSecondBubble ? (
                      <div className="chat-bubble chat-bubble-translation">
                        <span className="chat-section-label">Translation</span>
                        {resolveTranslationCopy(message)}
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </>
        )}
      </div>
      {showScrollToBottom && visibleMessages.length > 0 ? (
        <button
          aria-label="Scroll to latest message"
          className="scroll-to-bottom-btn"
          onClick={handleScrollToBottom}
          title="Scroll to latest"
        >
          <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      ) : null}
    </section>
  )
}

function isNearBottom(container: HTMLDivElement): boolean {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= 48
}

function shouldShowTranslation(message: ChatMessage): boolean {
  if (message.translatedText || message.errorMessage) {
    return true
  }

  return message.translationStatus === 'queued' || message.translationStatus === 'translating' || message.translationStatus === 'translated'
}

function resolveTranslationCopy(message: ChatMessage): string {
  if (message.translatedText) {
    return message.translatedText
  }

  if (message.errorMessage) {
    return message.errorMessage
  }

  return 'Waiting for translation.'
}

function resolveTranslationIndicatorTone(status: ChatMessage['translationStatus']): string {
  if (status === 'translated') {
    return 'is-translated'
  }

  if (status === 'error') {
    return 'is-error'
  }

  if (status === 'queued') {
    return 'is-queued'
  }

  if (status === 'translating') {
    return 'is-translating'
  }

  if (status === 'skipped') {
    return 'is-skipped'
  }

  return 'is-idle'
}

function resolveTranslationIndicatorLabel(status: ChatMessage['translationStatus']): string {
  if (status === 'translated') {
    return 'Translated'
  }

  if (status === 'error') {
    return 'Translation error'
  }

  if (status === 'queued') {
    return 'Queued for translation'
  }

  if (status === 'translating') {
    return 'Translating'
  }

  if (status === 'skipped') {
    return 'Translation skipped'
  }

  return 'Translation idle'
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function resolveMessageTone(message: ChatMessage, selectedCharacterLabel: string | null): string {
  if (message.messageType === 'system') {
    return 'system'
  }

  if (selectedCharacterLabel && message.senderName === selectedCharacterLabel) {
    return 'self'
  }

  return 'other'
}