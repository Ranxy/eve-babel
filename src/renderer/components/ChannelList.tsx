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
    <section className="panel channel-sidebar">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Channels</div>
          <h2>Channel navigator</h2>
        </div>
        <span className="chip">{selectedChannel?.channelName ?? `${props.channels.length} total`}</span>
      </div>
      <div className="channel-list">
        {props.channels.length === 0 ? <div className="empty-state">No channels were discovered for the selected character.</div> : null}
        {props.channels.map((channel) => {
          const isSelected = channel.channelName === props.selectedChannelName

          return (
            <div className={`channel-row ${isSelected ? 'selected' : ''}`} key={channel.channelName}>
              <button className="channel-select" onClick={() => props.onSelectChannel(channel.channelName)} type="button">
                <div className="channel-row-main">
                  <div className="channel-name">{channel.channelName}</div>
                  <span className="channel-count">{channel.messageCount}</span>
                </div>
                <div className="channel-meta">{channel.enabled ? 'Translation on' : 'Translation off'}</div>
              </button>
              <label className="channel-toggle">
                <span className="channel-toggle-label">On</span>
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