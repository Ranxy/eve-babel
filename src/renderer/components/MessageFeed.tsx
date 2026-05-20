import type { ChatMessage, ChannelSummary } from '../../shared/types'

interface MessageFeedProps {
  messages: ChatMessage[]
  channels: ChannelSummary[]
  selectedChannelName: string | null
  selectedCharacterLabel: string | null
}

export function MessageFeed(props: MessageFeedProps) {
  const selectedChannel = props.channels.find((channel) => channel.channelName === props.selectedChannelName) ?? null
  const visibleMessages = props.selectedChannelName
    ? props.messages.filter((message) => message.channelName === props.selectedChannelName)
    : []

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
      <div className="message-feed chat-thread">
        {!props.selectedChannelName ? (
          <div className="empty-state">Select a channel on the left to open its conversation stream.</div>
        ) : visibleMessages.length === 0 ? (
          <div className="empty-state">This channel has no cached messages yet.</div>
        ) : (
          visibleMessages.map((message) => (
            <article
              className={`chat-message ${resolveMessageTone(message, props.selectedCharacterLabel)}`}
              key={message.messageId}
            >
              <div className="chat-message-meta">
                <span className="chat-sender">{message.senderName}</span>
                <span className={`status-pill ${resolveStatusTone(message.translationStatus)}`}>{resolveStatusLabel(message)}</span>
                <span>{formatTime(message.timestamp)}</span>
              </div>
              <div className="chat-bubble-stack">
                <div className="chat-bubble chat-bubble-original">
                  <span className="chat-section-label">Original</span>
                  <div>{message.messageText}</div>
                </div>
                <div className="chat-bubble chat-bubble-translation">
                  <span className="chat-section-label">Translation</span>
                  {message.translatedText ??
                    message.errorMessage ??
                    (message.translationStatus === 'skipped' ? 'System message or translation disabled.' : 'Waiting for translation.')}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
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

  return 'Pending'
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