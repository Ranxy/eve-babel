import { useEffect, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
    <section className="border border-border bg-panel-surface rounded-3xl p-3.5 backdrop-blur-[18px] grid grid-rows-[auto_minmax(0,1fr)] gap-3 py-[14px] px-4 min-h-0 overflow-hidden relative">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start pb-2.5 border-b border-border">
        <div>
          <div className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('messageFeed.eyebrow')}</div>
          <h2>{selectedChannel?.channelName ?? t('messageFeed.chooseChannel')}</h2>
          {selectedChannel ? (
            <p className="mt-1.5 text-sm text-muted">
              {selectedChannel.enabled ? t('messageFeed.subtitleLive') : t('messageFeed.subtitleMuted')}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2 flex-wrap mt-2.5">
            {props.selectedCharacterLabel ? <span className="inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full bg-accent-cold-soft text-accent-cold text-xs font-bold">{props.selectedCharacterLabel}</span> : null}
            {selectedChannel ? (
              <span className={`inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full text-xs font-bold ${selectedChannel.enabled ? 'bg-[rgba(44,106,70,0.16)] text-ok' : 'bg-accent-cold-soft text-accent-cold'}`}>
                {selectedChannel.enabled ? t('messageFeed.translationLive') : t('messageFeed.translationMuted')}
              </span>
            ) : null}
          </div>
        </div>
        <div className="min-w-[92px] grid justify-items-end gap-0.5">
          <span className="text-[1.35rem] font-bold">{visibleMessages.length}</span>
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('messageFeed.messages')}</span>
        </div>
      </div>
      <div className="grid gap-3.5 min-h-0 overflow-auto pr-1.5 scrollbar-thin" onScroll={handleScroll} ref={messageFeedRef}>
        {!props.selectedChannelName ? (
          <div className="min-h-[180px] rounded-2xl border border-dashed border-border bg-empty-surface grid place-items-center text-center p-5">{t('messageFeed.selectChannelHint')}</div>
        ) : props.isLoadingMessages && visibleMessages.length === 0 ? (
          <div className="min-h-[180px] rounded-2xl border border-dashed border-border bg-empty-surface grid place-items-center text-center p-5">{t('messageFeed.loadingMessages')}</div>
        ) : visibleMessages.length === 0 ? (
          <div className="min-h-[180px] rounded-2xl border border-dashed border-border bg-empty-surface grid place-items-center text-center p-5">{t('messageFeed.noMessages')}</div>
        ) : (
          <>
            <div className="justify-self-center py-1.5 px-2.5 rounded-full bg-accent-cold-soft text-muted text-xs pointer-events-none [overflow-anchor:none]">
              {props.isLoadingMessages
                ? t('messageFeed.loadingEarlier')
                : props.hasMoreHistory
                  ? t('messageFeed.scrollForEarlier')
                  : t('messageFeed.reachedStart')}
            </div>
            {visibleMessages.map((message) => {
              const tone = resolveMessageTone(message, props.selectedCharacterLabel)
              const showTranslation = shouldShowTranslation(message)
              const showTranslationStatus = selectedChannel?.enabled === true && message.messageType === 'chat'

              const hasTranslation = !!message.translatedText
              const showSecondBubble = !hasTranslation && showTranslation

              return (
                <article
                  className={`grid gap-2.5 select-text ${
                    tone === 'self' ? 'justify-items-end' : tone === 'system' ? 'justify-items-center' : ''
                  }`}
                  key={message.messageId}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap text-muted text-sm">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {message.messageType === 'chat' && (
                        props.portraits[message.senderName] ? (
                          <img
                            alt={message.senderName}
                            className="size-7 rounded-full shrink-0 overflow-hidden object-cover border border-bubble-border bg-row-surface"
                            loading="lazy"
                            src={props.portraits[message.senderName]}
                          />
                        ) : (
                          <span aria-hidden="true" className="size-7 rounded-full shrink-0 overflow-hidden inline-flex items-center justify-center bg-accent-soft text-accent text-[0.72rem] font-bold border border-bubble-border">
                            {message.senderName.charAt(0).toUpperCase()}
                          </span>
                        )
                      )}
                      <span className="font-bold">{message.senderName}</span>
                    </span>
                    <span>{formatTime(message.timestamp)}</span>
                  </div>
                  <div className={`grid gap-1.5 ${tone === 'system' ? 'max-w-[min(72%,620px)] justify-self-center' : 'max-w-[min(84%,980px)]'}`}>
                    <div
                      className={`group/bubble rounded-2xl py-3 px-3.5 border border-bubble-border grid gap-1.5 select-text ${
                        tone === 'system'
                          ? 'bg-bubble-system-surface text-center'
                          : tone === 'self'
                            ? hasTranslation
                              ? 'bg-bubble-self-translation-surface'
                              : 'bg-bubble-self-original-surface text-bubble-self-original-text'
                            : hasTranslation
                              ? 'bg-bubble-translation-surface text-bubble-translation-text cursor-help'
                              : 'bg-bubble-original-surface'
                      }`}
                    >
                      <div className="inline-flex items-end gap-2">
                        {hasTranslation ? (
                          <>
                            <div className="min-w-0 flex-[1_1_auto] group-hover/bubble:hidden">{message.translatedText}</div>
                            <div className="min-w-0 flex-[1_1_auto] hidden group-hover/bubble:block">{message.messageText}</div>
                          </>
                        ) : (
                          <div className="min-w-0 flex-[1_1_auto]">{message.messageText}</div>
                        )}
                        {showTranslationStatus ? (
                          <span
                            aria-label={resolveTranslationIndicatorLabel(message.translationStatus, t)}
                            className={resolveTranslationIndicatorClasses(message.translationStatus)}
                            title={resolveTranslationIndicatorLabel(message.translationStatus, t)}
                          />
                        ) : null}
                      </div>
                    </div>
                    {showSecondBubble ? (
                      <div className={`rounded-2xl py-3 px-3.5 border border-bubble-border grid gap-1.5 select-text ${
                        tone === 'system'
                          ? 'bg-bubble-system-surface text-center'
                          : tone === 'self'
                            ? 'bg-bubble-self-translation-surface'
                            : 'bg-bubble-translation-surface text-bubble-translation-text'
                      }`}>
                        <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('messageFeed.translationLabel')}</span>
                        {resolveTranslationCopy(message, t)}
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
          aria-label={t('messageFeed.scrollToLatest')}
          className="absolute bottom-5 right-7 size-10 rounded-full border border-border bg-panel-hero-surface text-accent flex items-center justify-center cursor-pointer shadow-[0_4px_14px_rgba(46,59,75,0.14)] transition-[background,box-shadow,transform] duration-150 z-10 hover:bg-accent-soft hover:shadow-[0_6px_18px_rgba(46,59,75,0.18)] hover:-translate-y-px active:translate-y-0 active:shadow-[0_2px_8px_rgba(46,59,75,0.12)]"
          onClick={handleScrollToBottom}
          title={t('messageFeed.scrollToLatestTitle')}
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

function resolveTranslationCopy(message: ChatMessage, t: TFunction): string {
  if (message.translatedText) {
    return message.translatedText
  }

  if (message.errorMessage) {
    return message.errorMessage
  }

  return t('messageFeed.waitingForTranslation')
}

function resolveTranslationIndicatorClasses(status: ChatMessage['translationStatus']): string {
  const base = 'size-2.5 flex-none rounded-full border border-transparent bg-accent-cold-soft shadow-[inset_0_0_0_2px_transparent]'

  switch (status) {
    case 'translated':
      return `${base} bg-[rgba(44,106,70,0.24)] border-[rgba(44,106,70,0.55)]`
    case 'error':
      return `${base} bg-[rgba(182,95,85,0.22)] border-[rgba(182,95,85,0.55)]`
    case 'queued':
      return `${base} bg-[rgba(164,106,44,0.2)] border-[rgba(164,106,44,0.5)]`
    case 'translating':
      return `${base} bg-[rgba(164,106,44,0.2)] border-[rgba(164,106,44,0.5)] shadow-[0_0_0_2px_rgba(164,106,44,0.12)]`
    case 'skipped':
      return `${base} bg-[rgba(111,140,149,0.16)] border-[rgba(111,140,149,0.45)]`
    default:
      return `${base} border-[rgba(111,140,149,0.35)] bg-transparent`
  }
}

function resolveTranslationIndicatorLabel(status: ChatMessage['translationStatus'], t: TFunction): string {
  if (status === 'translated') {
    return t('messageFeed.translationStatus.translated')
  }

  if (status === 'error') {
    return t('messageFeed.translationStatus.error')
  }

  if (status === 'queued') {
    return t('messageFeed.translationStatus.queued')
  }

  if (status === 'translating') {
    return t('messageFeed.translationStatus.translating')
  }

  if (status === 'skipped') {
    return t('messageFeed.translationStatus.skipped')
  }

  return t('messageFeed.translationStatus.idle')
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