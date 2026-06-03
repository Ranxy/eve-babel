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
    <section className="grid grid-rows-[auto_minmax(0,1fr)] gap-2 min-h-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start pt-0.5 px-0.5 pb-0">
        <div>
          <div className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('channelList.eyebrow')}</div>
          <h2>{t('channelList.title')}</h2>
        </div>
        <span className="inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full bg-accent-soft text-accent text-xs font-bold">{selectedChannel ? t('channelList.focused') : t('channelList.total', { count: props.channels.length })}</span>
      </div>
      <div className="grid gap-2 min-h-0 overflow-auto pr-1 scrollbar-thin">
        {props.channels.length === 0 ? <div className="min-h-[180px] rounded-2xl border border-dashed border-border bg-empty-surface grid place-items-center text-center p-5">{t('channelList.noChannels')}</div> : null}
        {sorted.map((channel) => {
          const isSelected = channel.channelName === props.selectedChannelName

          return (
            <div
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 py-2.5 pr-2.5 pl-3 rounded-xl border border-border bg-row-surface items-center ${
                isSelected
                  ? 'border-[rgba(111,140,149,0.3)] bg-row-hover-surface'
                  : 'hover:border-[rgba(111,140,149,0.3)] hover:bg-row-hover-surface'
              }`}
              key={channel.channelName}
            >
              <button className="border-none bg-transparent p-0 text-left grid gap-1.5 text-inherit" onClick={() => props.onSelectChannel(channel.channelName)} type="button">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0 grid gap-1">
                    <div className="whitespace-nowrap overflow-hidden text-ellipsis font-bold">{channel.channelName}</div>
                    <div className="flex items-center gap-2 text-[0.76rem] text-muted uppercase tracking-[0.16em] [&_span:last-child]:text-muted">
                      <span>{formatSessionLabel(channel.latestSessionStarted, t('channelList.noSession'))}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-[5px] text-[0.76rem] before:content-[''] before:w-2 before:h-2 before:rounded-full before:bg-current ${
                      channel.enabled ? 'text-ok' : 'text-muted'
                    }`}
                  >
                      {channel.enabled ? t('channelList.translationOn') : t('channelList.translationOff')}
                  </span>
                </div>
              </button>
              <div className="grid justify-items-end content-center gap-1.5">
                <button
                  aria-label={t('channelList.overlayLabel', { name: channel.channelName })}
                  className="flex items-center justify-center size-[26px] p-0 mr-0.5 border-none rounded-xs bg-transparent text-muted text-sm cursor-pointer leading-none transition-[background,color] duration-120 hover:bg-accent-soft hover:text-accent"
                  onClick={() => void window.eveBabel.openOverlayWindow(channel.channelName)}
                  title={t('channelList.overlayTitle')}
                  type="button"
                >
                  ◧
                </button>
                <button
                  aria-label={channel.pinned ? t('channelList.unpinLabel', { name: channel.channelName }) : t('channelList.pinLabel', { name: channel.channelName })}
                  className={`min-h-6 min-w-[58px] border border-border rounded-full bg-transparent py-[3px] px-2 text-[0.7rem] ${
                    channel.pinned
                      ? 'bg-accent-soft border-[rgba(111,140,149,0.28)] text-accent'
                      : 'text-muted hover:bg-accent-soft hover:border-[rgba(111,140,149,0.28)] hover:text-accent focus-visible:bg-accent-soft focus-visible:border-[rgba(111,140,149,0.28)] focus-visible:text-accent'
                  }`}
                  onClick={() => props.onTogglePinned(channel.channelName, !channel.pinned)}
                  type="button"
                >
                  {channel.pinned ? t('channelList.pinned') : t('channelList.pin')}
                </button>
                <label className="grid justify-items-center content-center gap-1.5 [&_input]:size-4 [&_input]:[accent-color:var(--accent)]">
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