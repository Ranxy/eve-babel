import { useEffect, useRef, useState } from 'react'

import {
  DEFAULT_TARGET_LANGUAGE,
  DEFAULT_TRANSLATION_PROMPT,
  type AppSettingsUpdate,
  type BootstrapPayload,
  type ChannelMessagePage,
  type ChatMessage,
  type ChannelSummary
} from '../../shared/types'

const DEFAULT_CHANNEL_PAGE_SIZE = 10

interface LoadedChannelMessages extends ChannelMessagePage {
  loading: boolean
  loaded: boolean
}

interface AppStoreState extends BootstrapPayload {
  loading: boolean
  error: string | null
  channelMessages: Record<string, LoadedChannelMessages>
}

const emptyState: AppStoreState = {
  loading: true,
  error: null,
  directoryStatus: {
    path: null,
    exists: false,
    source: 'missing',
    errorMessage: null
  },
  config: {
    logDirectory: null,
    selectedCharacterId: null,
    enabledChannels: {},
    pinnedChannels: {},
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    translationPrompt: DEFAULT_TRANSLATION_PROMPT,
    apiBaseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4.1-mini',
    debounceMs: 350,
    maxQueueSize: 100
  },
  characters: [],
  channels: [],
  recentMessages: [],
  watcherStatus: {
    state: 'idle',
    watchedChannels: 0,
    activeFiles: 0,
    lastEventAt: null,
    lastError: null
  },
  apiStatus: {
    configured: false,
    queueLength: 0,
    activeJobs: 0,
    lastSuccessAt: null,
    lastError: null
  },
  channelMessages: {}
}

export function buildChannelStateKey(characterId: string, channelName: string): string {
  return `${characterId}::${channelName}`
}

export function useAppStore() {
  const [state, setState] = useState<AppStoreState>(emptyState)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    let disposed = false

    const applyPayload = (payload: BootstrapPayload) => {
      if (disposed) {
        return
      }

      setState((currentState) => ({
        ...currentState,
        ...payload,
        channelMessages: retainChannelMessages(currentState.channelMessages, payload.config.selectedCharacterId),
        loading: false,
        error: null
      }))
    }

    const load = async () => {
      try {
        applyPayload(await window.eveBabel.getBootstrapData())
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load app state'
        }))
      }
    }

    void load()

    const disposeMessages = window.eveBabel.onMessagesUpsert((messages) => {
      setState((currentState) => ({
        ...currentState,
        recentMessages: mergeMessages(currentState.recentMessages, messages),
        channelMessages: mergeChannelMessages(currentState.channelMessages, messages)
      }))
    })

    const disposeChannels = window.eveBabel.onChannelsUpdate((channels) => {
      setState((currentState) => ({
        ...currentState,
        channels
      }))
    })

    const disposeStatus = window.eveBabel.onStatusUpdate((status) => {
      setState((currentState) => ({
        ...currentState,
        ...status
      }))
    })

    return () => {
      disposed = true
      disposeMessages()
      disposeChannels()
      disposeStatus()
    }
  }, [])

  const runAction = async (action: Promise<BootstrapPayload>) => {
    setState((currentState) => ({
      ...currentState,
      loading: true,
      error: null
    }))

    try {
      const payload = await action
      setState((currentState) => ({
        ...currentState,
        ...payload,
        channelMessages: retainChannelMessages(currentState.channelMessages, payload.config.selectedCharacterId),
        loading: false,
        error: null
      }))
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Action failed'
      }))
    }
  }

  const loadChannelMessages = async (channelName: string) => {
    const selectedCharacterId = stateRef.current.config.selectedCharacterId
    if (!selectedCharacterId) {
      return
    }

    const key = buildChannelStateKey(selectedCharacterId, channelName)
    const existingPage = stateRef.current.channelMessages[key]
    if (existingPage?.loaded || existingPage?.loading) {
      return
    }

    setState((currentState) => ({
      ...currentState,
      channelMessages: {
        ...currentState.channelMessages,
        [key]: {
          characterId: selectedCharacterId,
          channelName,
          messages: existingPage?.messages ?? [],
          hasMore: existingPage?.hasMore ?? false,
          loading: true,
          loaded: false
        }
      }
    }))

    try {
      const page = await window.eveBabel.getChannelMessages(channelName, null, DEFAULT_CHANNEL_PAGE_SIZE)
      const pageKey = buildChannelStateKey(page.characterId, page.channelName)

      setState((currentState) => ({
        ...currentState,
        channelMessages: {
          ...currentState.channelMessages,
          [pageKey]: {
            ...page,
            loading: false,
            loaded: true
          }
        },
        error: null
      }))
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        channelMessages: {
          ...currentState.channelMessages,
          [key]: {
            characterId: selectedCharacterId,
            channelName,
            messages: existingPage?.messages ?? [],
            hasMore: existingPage?.hasMore ?? false,
            loading: false,
            loaded: false
          }
        },
        error: error instanceof Error ? error.message : 'Failed to load channel messages'
      }))
    }
  }

  const loadOlderChannelMessages = async (channelName: string) => {
    const selectedCharacterId = stateRef.current.config.selectedCharacterId
    if (!selectedCharacterId) {
      return
    }

    const key = buildChannelStateKey(selectedCharacterId, channelName)
    const existingPage = stateRef.current.channelMessages[key]
    if (!existingPage || existingPage.loading || !existingPage.loaded || !existingPage.hasMore || existingPage.messages.length === 0) {
      return
    }

    const oldestMessage = existingPage.messages[0]

    setState((currentState) => ({
      ...currentState,
      channelMessages: {
        ...currentState.channelMessages,
        [key]: {
          ...existingPage,
          loading: true
        }
      }
    }))

    try {
      const page = await window.eveBabel.getChannelMessages(
        channelName,
        {
          timestamp: oldestMessage.timestamp,
          messageId: oldestMessage.messageId
        },
        DEFAULT_CHANNEL_PAGE_SIZE
      )
      const pageKey = buildChannelStateKey(page.characterId, page.channelName)

      setState((currentState) => {
        const currentPage = currentState.channelMessages[pageKey] ?? existingPage

        return {
          ...currentState,
          channelMessages: {
            ...currentState.channelMessages,
            [pageKey]: {
              ...currentPage,
              ...page,
              messages: mergeMessages(page.messages, currentPage.messages, 0),
              loading: false,
              loaded: true
            }
          },
          error: null
        }
      })
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        channelMessages: {
          ...currentState.channelMessages,
          [key]: {
            ...existingPage,
            loading: false
          }
        },
        error: error instanceof Error ? error.message : 'Failed to load older channel messages'
      }))
    }
  }

  return {
    state,
    actions: {
      refreshScan: () => runAction(window.eveBabel.refreshScan()),
      chooseLogDirectory: () => runAction(window.eveBabel.chooseLogDirectory()),
      openSettingsWindow: () => window.eveBabel.openSettingsWindow(),
      setLogDirectory: (directory: string) => runAction(window.eveBabel.setLogDirectory(directory)),
      selectCharacter: (characterId: string) => runAction(window.eveBabel.selectCharacter(characterId)),
      setChannelEnabled: (channelName: string, enabled: boolean) => runAction(window.eveBabel.setChannelEnabled(channelName, enabled)),
      setChannelPinned: (channelName: string, pinned: boolean) => runAction(window.eveBabel.setChannelPinned(channelName, pinned)),
      updateSettings: (update: AppSettingsUpdate) => runAction(window.eveBabel.updateSettings(update)),
      loadChannelMessages,
      loadOlderChannelMessages
    }
  }
}

function retainChannelMessages(
  channelMessages: Record<string, LoadedChannelMessages>,
  selectedCharacterId: string | null
): Record<string, LoadedChannelMessages> {
  if (!selectedCharacterId) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(channelMessages).filter(([key]) => key.startsWith(`${selectedCharacterId}::`))
  )
}

function mergeChannelMessages(
  channelMessages: Record<string, LoadedChannelMessages>,
  messages: ChatMessage[]
): Record<string, LoadedChannelMessages> {
  if (messages.length === 0 || Object.keys(channelMessages).length === 0) {
    return channelMessages
  }

  const groupedMessages = new Map<string, ChatMessage[]>()

  for (const message of messages) {
    const key = buildChannelStateKey(message.characterId, message.channelName)
    const currentMessages = groupedMessages.get(key) ?? []
    currentMessages.push(message)
    groupedMessages.set(key, currentMessages)
  }

  let hasChanges = false
  const nextChannelMessages: Record<string, LoadedChannelMessages> = { ...channelMessages }

  for (const [key, page] of Object.entries(channelMessages)) {
    const nextMessages = groupedMessages.get(key)
    if (!nextMessages || nextMessages.length === 0) {
      continue
    }

    nextChannelMessages[key] = {
      ...page,
      messages: mergeMessages(page.messages, nextMessages, 0)
    }
    hasChanges = true
  }

  return hasChanges ? nextChannelMessages : channelMessages
}

function mergeMessages(currentMessages: ChatMessage[], nextMessages: ChatMessage[], maxMessages = 200): ChatMessage[] {
  const map = new Map(currentMessages.map((message) => [message.messageId, message]))

  for (const message of nextMessages) {
    map.set(message.messageId, message)
  }

  const mergedMessages = Array.from(map.values()).sort((left, right) => left.timestamp.localeCompare(right.timestamp))

  if (!maxMessages || maxMessages < 1) {
    return mergedMessages
  }

  return mergedMessages.slice(-maxMessages)
}

export type { AppStoreState, ChannelSummary }