import type { ChannelSummary } from '../../shared/types'

interface ChannelListProps {
  channels: ChannelSummary[]
  selectedChannelName: string | null
  onSelectChannel: (channelName: string) => void
  onToggleChannel: (channelName: string, enabled: boolean) => void
}

export function ChannelList(props: ChannelListProps) {
  const selectedChannel = props.channels.find((channel) => channel.channelName === props.selectedChannelName) ?? null

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
        {props.channels.map((channel) => {
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
                    {channel.enabled ? 'Live' : 'Muted'}
                  </span>
                </div>
              </button>
              <label className="channel-toggle">
                <span className="channel-toggle-label">{channel.enabled ? 'On' : 'Off'}</span>
                <input
                  checked={channel.enabled}
                  onChange={(event) => props.onToggleChannel(channel.channelName, event.target.checked)}
                  type="checkbox"
                />
              </label>
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