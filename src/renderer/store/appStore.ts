import { useEffect, useState } from 'react'

import type { AppSettingsUpdate, BootstrapPayload, ChatMessage, ChannelSummary } from '../../shared/types'

interface AppStoreState extends BootstrapPayload {
  loading: boolean
  error: string | null
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
    targetLanguage: 'zh-CN',
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
  }
}

export function useAppStore() {
  const [state, setState] = useState<AppStoreState>(emptyState)

  useEffect(() => {
    let disposed = false

    const applyPayload = (payload: BootstrapPayload) => {
      if (disposed) {
        return
      }

      setState((currentState) => ({
        ...currentState,
        ...payload,
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
        recentMessages: mergeMessages(currentState.recentMessages, messages)
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

  return {
    state,
    actions: {
      refreshScan: () => runAction(window.eveBabel.refreshScan()),
      chooseLogDirectory: () => runAction(window.eveBabel.chooseLogDirectory()),
      openSettingsWindow: () => window.eveBabel.openSettingsWindow(),
      setLogDirectory: (directory: string) => runAction(window.eveBabel.setLogDirectory(directory)),
      selectCharacter: (characterId: string) => runAction(window.eveBabel.selectCharacter(characterId)),
      setChannelEnabled: (channelName: string, enabled: boolean) => runAction(window.eveBabel.setChannelEnabled(channelName, enabled)),
      updateSettings: (update: AppSettingsUpdate) => runAction(window.eveBabel.updateSettings(update))
    }
  }
}

function mergeMessages(currentMessages: ChatMessage[], nextMessages: ChatMessage[]): ChatMessage[] {
  const map = new Map(currentMessages.map((message) => [message.messageId, message]))

  for (const message of nextMessages) {
    map.set(message.messageId, message)
  }

  return Array.from(map.values())
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-200)
}

export type { AppStoreState, ChannelSummary }