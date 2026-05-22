import type { ChannelSummary } from '../../shared/types'

interface ChannelListProps {
  channels: ChannelSummary[]
  selectedChannelName: string | null
  onSelectChannel: (channelName: string) => void
  onToggleChannel: (channelName: string, enabled: boolean) => void
  onTogglePinned: (channelName: string, pinned: boolean) => void
}

function toDateDay(timestamp: string | null): string {
  if (!timestamp) return ''
  return timestamp.slice(0, 10)
}

function sortedChannels(channels: ChannelSummary[]): ChannelSummary[] {
  return [...channels].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    const dayA = toDateDay(a.latestSessionStarted)
    const dayB = toDateDay(b.latestSessionStarted)
    if (dayB !== dayA) return dayB.localeCompare(dayA)
    return a.channelName.localeCompare(b.channelName)
  })
}

export function ChannelList(props: ChannelListProps) {
  const selectedChannel = props.channels.find((channel) => channel.channelName === props.selectedChannelName) ?? null
  const sorted = sortedChannels(props.channels)

  return (
    <section className="channel-sidebar">
      <div className="panel-header channel-sidebar-header">
        <div>
          <div className="eyebrow">Channels</div>
          <h2>Routes</h2>
        </div>
        <span className="chip">{selectedChannel ? 'Focused' : `${props.channels.length} total`}</span>
      </div>
      <div className="channel-list channel-list-scroll">
        {props.channels.length === 0 ? <div className="empty-state">No channels were discovered for the selected character.</div> : null}
        {sorted.map((channel) => {
          const isSelected = channel.channelName === props.selectedChannelName

          return (
            <div className={`channel-row ${isSelected ? 'selected' : ''}`} key={channel.channelName}>
              <button className="channel-select" onClick={() => props.onSelectChannel(channel.channelName)} type="button">
                <div className="channel-row-main">
                  <div className="channel-row-copy">
                    <div className="channel-name">{channel.channelName}</div>
                    <div className="channel-meta channel-meta-inline">
                      <span>{channel.messageCount} msgs</span>
                      <span>{formatSessionLabel(channel.latestSessionStarted)}</span>
                    </div>
                  </div>
                </div>
                <div className="channel-row-foot">
                  <span className={`channel-state ${channel.enabled ? 'is-live' : 'is-muted'}`}>
                    {channel.enabled ? 'Translation On' : 'Translation Off'}
                  </span>
                </div>
              </button>
              <div className="channel-actions">
                <button
                  aria-label={channel.pinned ? `Unpin ${channel.channelName}` : `Pin ${channel.channelName}`}
                  className={`channel-pin-button ${channel.pinned ? 'is-pinned' : ''}`}
                  onClick={() => props.onTogglePinned(channel.channelName, !channel.pinned)}
                  type="button"
                >
                  {channel.pinned ? 'Pinned' : 'Pin'}
                </button>
                <label className="channel-toggle">
                  <input
                    checked={channel.enabled}
                    onChange={(event) => props.onToggleChannel(channel.channelName, event.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function formatSessionLabel(timestamp: string | null): string {
  if (!timestamp) {
    return 'No session'
  }

  return new Date(timestamp).toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric'
  })
}