import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiStatus, AppConfig, ChatMessage } from '../../shared/types'
import { TranslationQueue } from './translationQueue'

const baseConfig: AppConfig = {
  logDirectory: null,
  selectedCharacterId: '9001',
  enabledChannels: {},
  pinnedChannels: {},
  llmDebugEnabled: false,
  targetLanguage: 'zh-CN',
  translationPrompt: 'Translate into {{targetLanguage}}.',
  activeProviderId: 'openai',
  apiBaseUrl: 'https://example.com/v1',
  modelName: 'test-model',
  debounceMs: 20,
  maxQueueSize: 100,
  glossary: []
}

function createMessage(messageId: string, channelName: string): ChatMessage {
  return {
    messageId,
    timestamp: `2026-05-20T12:${messageId.endsWith('2') ? '32' : '31'}:05`,
    channelName,
    characterId: '9001',
    senderName: 'Pilot One',
    messageText: `Text ${messageId}`,
    messageType: 'chat',
    sessionFilePath: `C:\\Users\\Ran\\Documents\\EVE\\logs\\Chatlogs\\${channelName}_20260520_123000_9001.txt`,
    translationStatus: 'idle',
    translatedText: null,
    errorMessage: null
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
}

class FakeMessageRepository {
  readonly messages = new Map<string, ChatMessage>()

  constructor(messages: ChatMessage[]) {
    for (const message of messages) {
      this.messages.set(message.messageId, message)
    }
  }

  async updateMessage(messageId: string, update: Partial<ChatMessage>): Promise<ChatMessage | null> {
    const currentMessage = this.messages.get(messageId)
    if (!currentMessage) {
      return null
    }

    const nextMessage = {
      ...currentMessage,
      ...update
    }
    this.messages.set(messageId, nextMessage)
    return nextMessage
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('TranslationQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('batches messages by channel and translates channels concurrently', async () => {
    const localDeferred = createDeferred<Map<string, string>>()
    const corpDeferred = createDeferred<Map<string, string>>()
    const apiStatuses: ApiStatus[] = []
    const repository = new FakeMessageRepository([
      createMessage('local-1', 'Local'),
      createMessage('local-2', 'Local'),
      createMessage('corp-1', 'Corp')
    ])
    const llmClient = {
      translateMessages: vi.fn(async (messages: ChatMessage[]) => {
        if (messages[0]?.channelName === 'Local') {
          return localDeferred.promise
        }

        return corpDeferred.promise
      })
    }
    const queue = new TranslationQueue(
      llmClient as never,
      { getActiveApiKey: vi.fn().mockResolvedValue('token') } as never,
      repository as never,
      {
        onMessageUpdated: vi.fn(),
        onApiStatusChanged: (status) => {
          apiStatuses.push(status)
        }
      }
    )

    await queue.refreshConfiguration(baseConfig)
    await queue.enqueue(repository.messages.get('local-1')!, baseConfig)
    await queue.enqueue(repository.messages.get('local-2')!, baseConfig)
    await queue.enqueue(repository.messages.get('corp-1')!, baseConfig)

    await vi.advanceTimersByTimeAsync(baseConfig.debounceMs)
    await flushMicrotasks()

    expect(llmClient.translateMessages).toHaveBeenCalledTimes(2)
    expect(queue.getStatus()).toMatchObject({
      queueLength: 0,
      activeJobs: 2
    })
    expect(llmClient.translateMessages).toHaveBeenCalledWith(
      [
        expect.objectContaining({ messageId: 'local-1', channelName: 'Local' }),
        expect.objectContaining({ messageId: 'local-2', channelName: 'Local' })
      ],
      expect.any(Object)
    )

    localDeferred.resolve(
      new Map([
        ['local-1', '本地一'],
        ['local-2', '本地二']
      ])
    )
    corpDeferred.resolve(new Map([['corp-1', '军团一']]))
    await flushMicrotasks()
    await flushMicrotasks()

    expect(repository.messages.get('local-1')).toMatchObject({ translationStatus: 'translated', translatedText: '本地一' })
    expect(repository.messages.get('local-2')).toMatchObject({ translationStatus: 'translated', translatedText: '本地二' })
    expect(repository.messages.get('corp-1')).toMatchObject({ translationStatus: 'translated', translatedText: '军团一' })
    expect(apiStatuses.at(-1)).toMatchObject({ queueLength: 0, activeJobs: 0 })
  })

  it('cancels queued jobs without interrupting an active batch', async () => {
    const localDeferred = createDeferred<Map<string, string>>()
    const repository = new FakeMessageRepository([createMessage('local-1', 'Local'), createMessage('local-2', 'Local')])
    const llmClient = {
      translateMessages: vi.fn(async () => localDeferred.promise)
    }
    const queue = new TranslationQueue(
      llmClient as never,
      { getActiveApiKey: vi.fn().mockResolvedValue('token') } as never,
      repository as never,
      {
        onMessageUpdated: vi.fn(),
        onApiStatusChanged: vi.fn()
      }
    )

    await queue.refreshConfiguration({ ...baseConfig, debounceMs: 0 })
    await queue.enqueue(repository.messages.get('local-1')!, { ...baseConfig, debounceMs: 0 })
    await vi.runAllTimersAsync()
    await flushMicrotasks()

    expect(queue.getStatus().activeJobs).toBe(1)
    expect(repository.messages.get('local-1')?.translationStatus).toBe('translating')

    await queue.enqueue(repository.messages.get('local-2')!, { ...baseConfig, debounceMs: 0 })
    expect(queue.getStatus().queueLength).toBe(1)

    await queue.cancelQueued()

    expect(queue.getStatus().queueLength).toBe(0)
    expect(repository.messages.get('local-2')).toMatchObject({ translationStatus: 'idle', translatedText: null })
    expect(repository.messages.get('local-1')?.translationStatus).toBe('translating')

    localDeferred.resolve(new Map([['local-1', '本地一']]))
    await flushMicrotasks()

    expect(repository.messages.get('local-1')).toMatchObject({ translationStatus: 'translated', translatedText: '本地一' })
    expect(llmClient.translateMessages).toHaveBeenCalledTimes(1)
  })
})