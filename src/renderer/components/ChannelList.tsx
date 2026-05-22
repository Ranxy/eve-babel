import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const selectedChannel = props.channels.find((channel) => channel.channelName === props.selectedChannelName) ?? null
  const sorted = sortedChannels(props.channels)

  return (
    <section className="channel-sidebar">
      <div className="panel-header channel-sidebar-header">
        <div>
          <div className="eyebrow">{t('channelList.eyebrow')}</div>
          <h2>{t('channelList.title')}</h2>
        </div>
        <span className="chip">{selectedChannel ? t('channelList.focused') : t('channelList.total', { count: props.channels.length })}</span>
      </div>
      <div className="channel-list channel-list-scroll">
        {props.channels.length === 0 ? <div className="empty-state">{t('channelList.noChannels')}</div> : null}
        {sorted.map((channel) => {
          const isSelected = channel.channelName === props.selectedChannelName

          return (
            <div className={`channel-row ${isSelected ? 'selected' : ''}`} key={channel.channelName}>
              <button className="channel-select" onClick={() => props.onSelectChannel(channel.channelName)} type="button">
                <div className="channel-row-main">
                  <div className="channel-row-copy">
                    <div className="channel-name">{channel.channelName}</div>
                    <div className="channel-meta channel-meta-inline">
                      <span>{t('channelList.msgCount', { count: channel.messageCount })}</span>
                      <span>{formatSessionLabel(channel.latestSessionStarted, t('channelList.noSession'))}</span>
                    </div>
                  </div>
                </div>
                <div className="channel-row-foot">
                  <span className={`channel-state ${channel.enabled ? 'is-live' : 'is-muted'}`}>
                      {channel.enabled ? t('channelList.translationOn') : t('channelList.translationOff')}
                  </span>
                </div>
              </button>
              <div className="channel-actions">
                <button
                  aria-label={channel.pinned ? t('channelList.unpinLabel', { name: channel.channelName }) : t('channelList.pinLabel', { name: channel.channelName })}
                  className={`channel-pin-button ${channel.pinned ? 'is-pinned' : ''}`}
                  onClick={() => props.onTogglePinned(channel.channelName, !channel.pinned)}
                  type="button"
                >
                  {channel.pinned ? t('channelList.pinned') : t('channelList.pin')}
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

function formatSessionLabel(timestamp: string | null, noSessionText: string): string {
  if (!timestamp) {
    return noSessionText
  }

  return new Date(timestamp).toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric'
  })
}