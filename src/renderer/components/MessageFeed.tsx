import { useEffect, useMemo, useRef } from 'react'

import type { ChatMessage, ChannelSummary } from '../../shared/types'

interface MessageFeedProps {
  messages: ChatMessage[]
  channels: ChannelSummary[]
  selectedChannelName: string | null
  selectedCharacterLabel: string | null
}

export function MessageFeed(props: MessageFeedProps) {
  const messageFeedRef = useRef<HTMLDivElement | null>(null)
  const selectedChannel = props.channels.find((channel) => channel.channelName === props.selectedChannelName) ?? null
  const visibleMessages = useMemo(
    () => (props.selectedChannelName ? props.messages.filter((message) => message.channelName === props.selectedChannelName) : []),
    [props.messages, props.selectedChannelName]
  )

  useEffect(() => {
    const container = messageFeedRef.current
    if (!container || !props.selectedChannelName || visibleMessages.length === 0) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [props.selectedChannelName, visibleMessages.length, visibleMessages.at(-1)?.messageId])

  return (
    <section className="panel message-panel">
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
      <div className="message-feed chat-thread" ref={messageFeedRef}>
        {!props.selectedChannelName ? (
          <div className="empty-state">Select a channel on the left to open its conversation stream.</div>
        ) : visibleMessages.length === 0 ? (
          <div className="empty-state">This channel has no cached messages yet.</div>
        ) : (
          visibleMessages.map((message) => {
            const showTranslation = shouldShowTranslation(message)
            const showTranslationStatus = selectedChannel?.enabled === true && message.messageType === 'chat'
            const statusLabel = resolveStatusLabel(message)

            return (
              <article
                className={`chat-message ${resolveMessageTone(message, props.selectedCharacterLabel)}`}
                key={message.messageId}
              >
                <div className="chat-message-meta">
                  <span className="chat-sender">{message.senderName}</span>
                  {statusLabel ? <span className={`status-pill ${resolveStatusTone(message.translationStatus)}`}>{statusLabel}</span> : null}
                  <span>{formatTime(message.timestamp)}</span>
                </div>
                <div className="chat-bubble-stack">
                  <div className="chat-bubble chat-bubble-original">
                    <span className="chat-section-label">Original</span>
                    <div className="chat-bubble-body">
                      <div className="chat-bubble-copy">{message.messageText}</div>
                      {showTranslationStatus ? (
                        <span
                          aria-label={resolveTranslationIndicatorLabel(message.translationStatus)}
                          className={`translation-indicator ${resolveTranslationIndicatorTone(message.translationStatus)}`}
                          title={resolveTranslationIndicatorLabel(message.translationStatus)}
                        />
                      ) : null}
                    </div>
                  </div>
                  {showTranslation ? (
                    <div className="chat-bubble chat-bubble-translation">
                      <span className="chat-section-label">Translation</span>
                      {resolveTranslationCopy(message)}
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
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

function resolveStatusLabel(message: ChatMessage): string {
  if (message.translationStatus === 'translated') {
    return 'Translated'
  }

  if (message.translationStatus === 'error') {
    return 'Error'
  }

  if (message.translationStatus === 'translating') {
    return 'Translating'
  }

  if (message.translationStatus === 'queued') {
    return 'Queued'
  }

  if (message.translationStatus === 'skipped') {
    return 'Skipped'
  }

  return ''
}

function resolveStatusTone(status: ChatMessage['translationStatus']): string {
  if (status === 'translated') {
    return 'status-translated'
  }

  if (status === 'error') {
    return 'status-error'
  }

  if (status === 'queued' || status === 'translating') {
    return 'status-translating'
  }

  return 'status-idle'
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