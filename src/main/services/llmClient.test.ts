import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AppConfig, ChatMessage } from '../../shared/types'
import { LlmClient } from './llmClient'

const baseConfig: AppConfig = {
  logDirectory: null,
  selectedCharacterId: '9001',
  enabledChannels: {},
  pinnedChannels: {},
  llmDebugEnabled: false,
  targetLanguage: 'zh-CN',
  translationPrompt: 'Translate into {{targetLanguage}}.',
  apiBaseUrl: 'https://example.com/v1',
  modelName: 'test-model',
  debounceMs: 0,
  maxQueueSize: 100
}

function createMessage(messageId: string, messageText: string): ChatMessage {
  return {
    messageId,
    timestamp: '2026-05-20T12:31:05',
    channelName: 'Local',
    characterId: '9001',
    senderName: 'Pilot One',
    messageText,
    messageType: 'chat',
    sessionFilePath: 'C:\\Users\\Ran\\Documents\\EVE\\logs\\Chatlogs\\Local_20260520_123000_9001.txt',
    translationStatus: 'idle',
    translatedText: null,
    errorMessage: null
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LlmClient', () => {
  it('parses structured batch translations from JSON code fences', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: '```json\n{"translations":[{"messageId":"m-1","translatedText":"你好"},{"messageId":"m-2","translatedText":"再见"}]}\n```'
              }
            }
          ]
        })
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new LlmClient()
    const result = await client.translateMessages(
      [createMessage('m-1', 'Hello'), createMessage('m-2', 'Bye')],
      {
        apiKey: 'token',
        config: baseConfig
      }
    )

    expect(result).toEqual(
      new Map([
        ['m-1', '你好'],
        ['m-2', '再见']
      ])
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    const userPayload = JSON.parse(requestBody.messages[1].content) as {
      messages: Array<{ messageId: string; messageText: string }>
    }

    expect(userPayload.messages).toEqual([
      expect.objectContaining({ messageId: 'm-1', messageText: 'Hello' }),
      expect.objectContaining({ messageId: 'm-2', messageText: 'Bye' })
    ])
  })

  it('logs request and response payloads when LLM debugger is enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: '{"translations":[{"messageId":"m-1","translatedText":"你好"}]}'
            }
          }
        ]
      })
    })
    const debugLogger = {
      logExchange: vi.fn().mockResolvedValue(undefined)
    }
    vi.stubGlobal('fetch', fetchMock)

    const client = new LlmClient(debugLogger as never)
    await client.translateMessages(
      [createMessage('m-1', 'Hello')],
      {
        apiKey: 'token',
        config: {
          ...baseConfig,
          llmDebugEnabled: true
        }
      }
    )

    expect(debugLogger.logExchange).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer [redacted]' })
        }),
        response: expect.objectContaining({
          status: 200,
          ok: true,
          bodyText: expect.stringContaining('translations')
        }),
        error: null
      })
    )
  })
})