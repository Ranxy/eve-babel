import { randomUUID } from 'node:crypto'

import type { ApiStatus, AppConfig, ChatMessage, TranslationJob } from '../../shared/types'
import { LlmClient } from './llmClient'
import { LlmConfigStore } from './llmConfigStore'
import { MessageRepository } from './messageRepository'

interface TranslationQueueCallbacks {
  onMessageUpdated: (message: ChatMessage) => void
  onApiStatusChanged: (status: ApiStatus) => void
}

export class TranslationQueue {
  private readonly queue: TranslationJob[] = []
  private readonly queuedIds = new Set<string>()
  private activeJobs = 0
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
      queueLength: this.queue.length,
      activeJobs: this.activeJobs
    }
    this.callbacks.onApiStatusChanged(this.getStatus())
  }

  async enqueue(message: ChatMessage, config: AppConfig): Promise<void> {
    if (this.queuedIds.has(message.messageId)) {
      return
    }

    if (this.queue.length >= config.maxQueueSize) {
      const updatedMessage = await this.messageRepository.updateMessage(message.messageId, {
        translationStatus: 'error',
        errorMessage: 'Translation queue is full.'
      })

      if (updatedMessage) {
        this.callbacks.onMessageUpdated(updatedMessage)
      }
      return
    }

    this.queuedIds.add(message.messageId)
    this.queue.push({
      jobId: randomUUID(),
      messageId: message.messageId,
      targetLanguage: config.targetLanguage,
      provider: 'openai-compatible',
      model: config.modelName,
      retryCount: 0,
      queuedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null
    })

    const queuedMessage = await this.messageRepository.updateMessage(message.messageId, {
      translationStatus: 'queued',
      errorMessage: null
    })

    if (queuedMessage) {
      this.callbacks.onMessageUpdated(queuedMessage)
    }

    this.publishStatus({ configured: this.apiStatus.configured })
    void this.drain(config)
  }

  private async drain(config: AppConfig): Promise<void> {
    if (this.activeJobs > 0 || this.queue.length === 0) {
      return
    }

    const job = this.queue.shift()
    if (!job) {
      this.publishStatus({ configured: this.apiStatus.configured })
      return
    }

    this.activeJobs += 1
    this.publishStatus({ configured: this.apiStatus.configured })

    try {
      const apiKey = await this.llmConfigStore.getApiKey()
      if (!apiKey) {
        throw new Error('API key is not configured.')
      }

      const message = await this.messageRepository.updateMessage(job.messageId, {
        translationStatus: 'translating',
        errorMessage: null
      })

      if (!message) {
        return
      }

      this.callbacks.onMessageUpdated(message)

      const translatedText = await this.llmClient.translateText(message.messageText, {
        apiKey,
        config
      })

      const updatedMessage = await this.messageRepository.updateMessage(job.messageId, {
        translationStatus: 'translated',
        translatedText,
        errorMessage: null
      })

      if (updatedMessage) {
        this.callbacks.onMessageUpdated(updatedMessage)
      }

      this.apiStatus = {
        ...this.apiStatus,
        configured: true,
        lastSuccessAt: new Date().toISOString(),
        lastError: null
      }
    } catch (error) {
      const updatedMessage = await this.messageRepository.updateMessage(job.messageId, {
        translationStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown translation error'
      })

      if (updatedMessage) {
        this.callbacks.onMessageUpdated(updatedMessage)
      }

      this.apiStatus = {
        ...this.apiStatus,
        lastError: error instanceof Error ? error.message : 'Unknown translation error'
      }
    } finally {
      this.queuedIds.delete(job.messageId)
      this.activeJobs -= 1
      this.publishStatus({ configured: this.apiStatus.configured })

      if (this.queue.length > 0) {
        void this.drain(config)
      }
    }
  }

  private publishStatus(update: Pick<ApiStatus, 'configured'>): void {
    this.apiStatus = {
      ...this.apiStatus,
      ...update,
      queueLength: this.queue.length,
      activeJobs: this.activeJobs
    }

    this.callbacks.onApiStatusChanged(this.getStatus())
  }
}