import { randomUUID } from 'node:crypto'

import type { ApiStatus, AppConfig, ChatMessage, TranslationJob } from '../../shared/types'
import { LlmClient } from './llmClient'
import { LlmConfigStore } from './llmConfigStore'
import { MessageRepository } from './messageRepository'

const MAX_BATCH_SIZE = 10

interface TranslationQueueCallbacks {
  onMessageUpdated: (message: ChatMessage) => void
  onApiStatusChanged: (status: ApiStatus) => void
}

export class TranslationQueue {
  private readonly channelQueues = new Map<string, TranslationJob[]>()
  private readonly pendingMessageIds = new Set<string>()
  private readonly activeChannels = new Set<string>()
  private readonly channelTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private apiStatus: ApiStatus = {
    configured: false,
    queueLength: 0,
    activeJobs: 0,
    lastSuccessAt: null,
    lastError: null
  }

  constructor(
    private readonly llmClient: LlmClient,
    private readonly llmConfigStore: LlmConfigStore,
    private readonly messageRepository: MessageRepository,
    private readonly callbacks: TranslationQueueCallbacks
  ) {}

  getStatus(): ApiStatus {
    return { ...this.apiStatus }
  }

  async refreshConfiguration(config: AppConfig): Promise<void> {
    const apiKey = await this.llmConfigStore.getApiKey()
    this.apiStatus = {
      ...this.apiStatus,
      configured: Boolean(apiKey && config.apiBaseUrl && config.modelName),
      queueLength: this.getQueueLength(),
      activeJobs: this.activeChannels.size
    }
    this.callbacks.onApiStatusChanged(this.getStatus())
  }

  async enqueue(message: ChatMessage, config: AppConfig): Promise<void> {
    if (this.pendingMessageIds.has(message.messageId)) {
      return
    }

    if (this.getQueueLength() >= config.maxQueueSize) {
      const updatedMessage = await this.messageRepository.updateMessage(message.messageId, {
        translationStatus: 'error',
        errorMessage: 'Translation queue is full.'
      })

      if (updatedMessage) {
        this.callbacks.onMessageUpdated(updatedMessage)
      }
      return
    }

    const channelKey = this.getChannelKey(message.characterId, message.channelName)
    const queue = this.channelQueues.get(channelKey) ?? []

    this.pendingMessageIds.add(message.messageId)
    queue.push({
      jobId: randomUUID(),
      messageId: message.messageId,
      characterId: message.characterId,
      channelName: message.channelName,
      senderName: message.senderName,
      messageText: message.messageText,
      timestamp: message.timestamp,
      targetLanguage: config.targetLanguage,
      provider: 'openai-compatible',
      model: config.modelName,
      retryCount: 0,
      queuedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null
    })
    this.channelQueues.set(channelKey, queue)

    const queuedMessage = await this.messageRepository.updateMessage(message.messageId, {
      translationStatus: 'queued',
      errorMessage: null
    })

    if (queuedMessage) {
      this.callbacks.onMessageUpdated(queuedMessage)
    }

    this.publishStatus({ configured: this.apiStatus.configured })
    this.scheduleDrain(channelKey, config)
  }

  async cancelQueued(): Promise<void> {
    const queuedJobs = Array.from(this.channelQueues.values()).flat()

    for (const timer of this.channelTimers.values()) {
      clearTimeout(timer)
    }

    this.channelTimers.clear()
    this.channelQueues.clear()

    for (const job of queuedJobs) {
      this.pendingMessageIds.delete(job.messageId)

      const updatedMessage = await this.messageRepository.updateMessage(job.messageId, {
        translationStatus: 'idle',
        errorMessage: null
      })

      if (updatedMessage) {
        this.callbacks.onMessageUpdated(updatedMessage)
      }
    }

    this.publishStatus({ configured: this.apiStatus.configured })
  }

  private scheduleDrain(channelKey: string, config: AppConfig, delayMs = config.debounceMs): void {
    if (this.activeChannels.has(channelKey) || this.channelTimers.has(channelKey)) {
      return
    }

    const timer = setTimeout(() => {
      this.channelTimers.delete(channelKey)
      void this.drainChannel(channelKey, config)
    }, Math.max(0, delayMs))

    this.channelTimers.set(channelKey, timer)
  }

  private async drainChannel(channelKey: string, config: AppConfig): Promise<void> {
    if (this.activeChannels.has(channelKey)) {
      return
    }

    const queue = this.channelQueues.get(channelKey)
    if (!queue || queue.length === 0) {
      this.channelQueues.delete(channelKey)
      this.publishStatus({ configured: this.apiStatus.configured })
      return
    }

    const jobs = queue.splice(0, MAX_BATCH_SIZE)
    if (queue.length === 0) {
      this.channelQueues.delete(channelKey)
    }

    this.activeChannels.add(channelKey)
    this.publishStatus({ configured: this.apiStatus.configured })

    try {
      const apiKey = await this.llmConfigStore.getApiKey()
      if (!apiKey) {
        throw new Error('API key is not configured.')
      }

      const translatingMessages = await Promise.all(
        jobs.map((job) =>
          this.messageRepository.updateMessage(job.messageId, {
            translationStatus: 'translating',
            errorMessage: null
          })
        )
      )

      const messagesToTranslate = translatingMessages.filter((message): message is ChatMessage => message !== null)
      if (messagesToTranslate.length === 0) {
        return
      }

      for (const message of messagesToTranslate) {
        this.callbacks.onMessageUpdated(message)
      }

      const translations = await this.llmClient.translateMessages(messagesToTranslate, {
        apiKey,
        config
      })

      for (const message of messagesToTranslate) {
        const translatedText = translations.get(message.messageId)
        if (!translatedText) {
          throw new Error(`Translation response did not contain message ${message.messageId}`)
        }

        const updatedMessage = await this.messageRepository.updateMessage(message.messageId, {
          translationStatus: 'translated',
          translatedText,
          errorMessage: null
        })

        if (updatedMessage) {
          this.callbacks.onMessageUpdated(updatedMessage)
        }
      }

      this.apiStatus = {
        ...this.apiStatus,
        configured: true,
        lastSuccessAt: new Date().toISOString(),
        lastError: null
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown translation error'

      for (const job of jobs) {
        const updatedMessage = await this.messageRepository.updateMessage(job.messageId, {
          translationStatus: 'error',
          errorMessage
        })

        if (updatedMessage) {
          this.callbacks.onMessageUpdated(updatedMessage)
        }
      }

      this.apiStatus = {
        ...this.apiStatus,
        lastError: errorMessage
      }
    } finally {
      for (const job of jobs) {
        this.pendingMessageIds.delete(job.messageId)
      }

      this.activeChannels.delete(channelKey)
      this.publishStatus({ configured: this.apiStatus.configured })

      if ((this.channelQueues.get(channelKey)?.length ?? 0) > 0) {
        this.scheduleDrain(channelKey, config, 0)
      }
    }
  }

  private getChannelKey(characterId: string, channelName: string): string {
    return `${characterId}::${channelName}`
  }

  private getQueueLength(): number {
    let total = 0

    for (const queue of this.channelQueues.values()) {
      total += queue.length
    }

    return total
  }

  private publishStatus(update: Pick<ApiStatus, 'configured'>): void {
    this.apiStatus = {
      ...this.apiStatus,
      ...update,
      queueLength: this.getQueueLength(),
      activeJobs: this.activeChannels.size
    }

    this.callbacks.onApiStatusChanged(this.getStatus())
  }
}