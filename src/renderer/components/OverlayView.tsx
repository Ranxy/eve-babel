import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatMessage } from '../../shared/types'
import { buildChannelStateKey, useAppStore } from '../store/appStore'

interface OverlayViewProps {
  channelName: string
}

export function OverlayView({ channelName }: OverlayViewProps) {
  const { state, actions } = useAppStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isOpaque, setIsOpaque] = useState(true)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const resizeStartY = useRef<number | null>(null)

  const selectedCharacterId = state.config.selectedCharacterId

  useEffect(() => {
    document.documentElement.style.background = '#f0f2f6'
    document.body.style.background = '#f0f2f6'
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.background = ''
      document.body.style.background = ''
      document.body.style.margin = ''
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (isOpaque) {
      document.documentElement.style.background = '#f0f2f6'
      document.body.style.background = '#f0f2f6'
    } else {
      document.documentElement.style.background = 'transparent'
      document.body.style.background = 'transparent'
    }
  }, [isOpaque])

  useEffect(() => {
    if (!selectedCharacterId) {
      return
    }

    void actions.loadChannelMessages(channelName)
  }, [actions, channelName, selectedCharacterId])

  useEffect(() => {
    if (!selectedCharacterId) {
      return
    }

    const key = buildChannelStateKey(selectedCharacterId, channelName)
    const pageMessages = state.channelMessages[key]?.messages ?? []
    const mergedMessages = mergeMessages(pageMessages, state.recentMessages.filter(
      (m) => m.characterId === selectedCharacterId && m.channelName === channelName
    ))

    setMessages(mergedMessages)
  }, [channelName, selectedCharacterId, state.channelMessages, state.recentMessages])

  useEffect(() => {
    const container = feedRef.current
    if (!container || !shouldAutoScrollRef.current) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [messages])

  const handleScroll = () => {
    const container = feedRef.current
    if (!container) {
      return
    }

    shouldAutoScrollRef.current = isNearBottom(container)
  }

  const handleClose = useCallback(() => {
    void window.eveBabel.closeOverlayWindow()
  }, [])

  const handleResizeMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    resizeStartY.current = event.screenY

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (resizeStartY.current === null) {
        return
      }

      const deltaY = moveEvent.screenY - resizeStartY.current
      resizeStartY.current = moveEvent.screenY
      void window.eveBabel.resizeOverlayBody(deltaY)
    }

    const handleMouseUp = () => {
      resizeStartY.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  const selectedCharacter = state.characters.find((c) => c.characterId === selectedCharacterId) ?? null
  const chatMessages = messages.filter((m) => m.messageType === 'chat')

  const msgBg = isOpaque ? 'bg-black/5' : 'bg-white/10'
  const selfMsgBg = isOpaque ? 'bg-[rgba(70,100,120,0.08)]' : 'bg-white/15'
  const textMain = isOpaque ? 'text-[#0d0d1a]' : 'text-white'
  const textMuted = isOpaque ? 'text-[#2d2d44]' : 'text-white/80'
  const textSender = isOpaque ? 'text-[#2d4a6e]' : 'text-white/90'
  const textSenderSelf = isOpaque ? 'text-[#1d3a55]' : 'text-white'
  const textTime = isOpaque ? 'text-[#556666]' : 'text-white/50'
  const textTranslated = isOpaque ? 'text-[#0d0d1a]' : 'text-white'
  const textOriginal = isOpaque ? 'text-[#445566]' : 'text-white/70'
  const textEmpty = isOpaque ? 'text-[#555566]' : 'text-white/40'
  const textShadow = isOpaque
    ? '[text-shadow:0_0_3px_rgba(255,255,255,0.7)]'
    : '[text-shadow:0_0_3px_rgba(0,0,0,0.7)]'
  const borderLOther = isOpaque
    ? 'border-l-[rgba(100,120,140,0.25)]'
    : 'border-l-white/20'
  const borderLSelf = isOpaque
    ? 'border-l-[rgba(70,100,120,0.45)]'
    : 'border-l-white/40'
  const headerBorder = isOpaque ? 'border-black/[0.03]' : 'border-white/10'
  const hoverBg = isOpaque ? 'hover:bg-black/10' : 'hover:bg-white/10'
  const closeHoverColor = isOpaque ? 'hover:text-[#b03a3a]' : 'hover:text-red-300'
  const closeHoverBg = isOpaque
    ? 'hover:bg-[rgba(200,60,60,0.15)]'
    : 'hover:bg-red-500/20'
  const resizeHover = isOpaque ? 'hover:bg-black/[0.06]' : 'hover:bg-white/10'

  return (
    <div
      className={`flex flex-col h-full rounded-md border overflow-hidden font-sans [-webkit-app-region:none] ${textShadow} ${
        isOpaque
          ? 'bg-[#f0f2f6] border-black/10 text-[#0d0d1a]'
          : 'bg-white/10 border-white/10 text-white'
      }`}
    >
      <div className={`flex items-center justify-between h-8 px-[5px] shrink-0 border-b ${headerBorder} select-none text-xs leading-none`}>
        <div className="flex-1 [-webkit-app-region:drag] flex items-center h-full px-2">
          <span className={`font-semibold tracking-[0.02em] ${textMain}`}>{channelName}</span>
        </div>
        <div className="flex items-center gap-0.5 [-webkit-app-region:none]">
          <button
            aria-label={isOpaque ? 'Switch to transparent' : 'Switch to opaque'}
            className={`flex items-center justify-center size-[22px] p-0 border-none rounded-xs bg-transparent text-xs cursor-pointer leading-none transition-[background,color] duration-120 ${textMuted} ${hoverBg} hover:${textMain}`}
            onClick={() => setIsOpaque((v) => !v)}
            title={isOpaque ? 'Switch to transparent mode' : 'Switch to opaque mode'}
            type="button"
          >
            {isOpaque ? '◉' : '◌'}
          </button>
          <button
            aria-label="Close overlay"
            className={`flex items-center justify-center size-[22px] p-0 border-none rounded-xs bg-transparent text-xs cursor-pointer leading-none transition-[background,color] duration-120 ${textMuted} ${closeHoverBg} ${closeHoverColor}`}
            onClick={handleClose}
            title="Close overlay"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2.5 scroll-smooth scrollbar-overlay" onScroll={handleScroll} ref={feedRef}>
        {chatMessages.length === 0 ? (
          <div className={`flex items-center justify-center h-full text-xs italic ${textEmpty}`}>Waiting for messages…</div>
        ) : (
          chatMessages.map((message) => {
            const hasTranslation = !!message.translatedText
            const isSelf = selectedCharacter?.label != null && message.senderName === selectedCharacter.label

            return (
              <div
                className={`mb-1.5 px-1.5 py-1 rounded-xs border-l-2 ${
                  isSelf
                    ? `${borderLSelf} ${selfMsgBg}`
                    : `${borderLOther} ${msgBg}`
                }`}
                key={message.messageId}
              >
                <div className="flex items-baseline justify-between mb-0.5">
                  <span
                    className={`text-[0.7rem] font-semibold max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap ${
                      isSelf ? textSenderSelf : textSender
                    }`}
                  >
                    {message.senderName}
                  </span>
                  <span className={`text-[0.62rem] shrink-0 ${textTime}`}>{formatOverlayTime(message.timestamp)}</span>
                </div>
                {hasTranslation ? (
                  <>
                    <div className={`text-xs font-medium leading-[1.4] mb-px break-words ${textTranslated}`}>{message.translatedText}</div>
                    <div className={`text-[0.67rem] leading-[1.35] break-words ${textOriginal}`}>{message.messageText}</div>
                  </>
                ) : (
                  <div className={`text-[0.67rem] leading-[1.35] break-words ${textOriginal}`}>{message.messageText}</div>
                )}
              </div>
            )
          })
        )}
      </div>
      <div
        className={`shrink-0 h-1.5 cursor-s-resize bg-transparent [-webkit-app-region:none] ${resizeHover}`}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  )
}

function isNearBottom(container: HTMLDivElement): boolean {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= 32
}

function formatOverlayTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function mergeMessages(pageMessages: ChatMessage[], recentMessages: ChatMessage[]): ChatMessage[] {
  if (recentMessages.length === 0 && pageMessages.length > 0) {
    return pageMessages
  }

  const map = new Map<string, ChatMessage>()

  for (const message of pageMessages) {
    map.set(message.messageId, message)
  }

  for (const message of recentMessages) {
    map.set(message.messageId, message)
  }

  return Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-200)
}
