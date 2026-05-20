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
      <div className="panel-header">
        <div>
          <div className="eyebrow">Conversation</div>
          <h2>{selectedChannel?.channelName ?? 'Choose a channel'}</h2>
          {selectedChannel ? <p className="conversation-subtitle">{selectedChannel.enabled ? 'Translation enabled for new messages' : 'Translation disabled for this channel'}</p> : null}
        </div>
        <span className="chip">{visibleMessages.length} messages</span>
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
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="chat-bubble-stack">
                <div className="chat-bubble chat-bubble-original">{message.messageText}</div>
                <div className="chat-bubble chat-bubble-translation">
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

function resolveMessageTone(message: ChatMessage, selectedCharacterLabel: string | null): string {
  if (message.messageType === 'system') {
    return 'system'
  }

  if (selectedCharacterLabel && message.senderName === selectedCharacterLabel) {
    return 'self'
  }

  return 'other'
}