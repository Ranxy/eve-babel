import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '../../shared/types'
import { selectHistoryMessagesForTranslation } from './historyTranslationSelector'

function createMessage(index: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    messageId: `message-${index}`,
    timestamp: `2026-05-20T12:${String(index).padStart(2, '0')}:00`,
    channelName: 'Local',
    characterId: '9001',
    senderName: 'Pilot One',
    messageText: `Message ${index}`,
    messageType: 'chat',
    sessionFilePath: 'C:\\Users\\Ran\\Documents\\EVE\\logs\\Chatlogs\\Local_20260520_120000_9001.txt',
    translationStatus: 'idle',
    translatedText: null,
    errorMessage: null,
    ...overrides
  }
}

describe('selectHistoryMessagesForTranslation', () => {
  it('only considers the newest ten historical messages before filtering untranslated items', () => {
    const messages = Array.from({ length: 12 }, (_value, index) =>
      createMessage(index + 1, {
        translationStatus: index < 2 ? 'idle' : 'translated',
        translatedText: index < 2 ? null : `Translated ${index + 1}`
      })
    )

    const selected = selectHistoryMessagesForTranslation(messages, 10)

    expect(selected).toEqual([])
  })

  it('selects untranslated or failed chat messages from the newest history window only', () => {
    const messages = [
      createMessage(1, { translationStatus: 'idle' }),
      createMessage(2, { translationStatus: 'translated', translatedText: 'done' }),
      createMessage(3, { translationStatus: 'error', errorMessage: 'failed once' }),
      createMessage(4, { translationStatus: 'queued' }),
      createMessage(5, { translationStatus: 'translating' }),
      createMessage(6, { messageType: 'system', translationStatus: 'skipped' }),
      createMessage(7, { translationStatus: 'idle' })
    ]

    const selected = selectHistoryMessagesForTranslation(messages, 5)

    expect(selected.map((message) => message.messageId)).toEqual(['message-3', 'message-7'])
  })
})