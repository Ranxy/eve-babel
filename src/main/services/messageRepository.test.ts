import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { ChatMessage } from '../../shared/types'
import { MessageRepository } from './messageRepository'

const tempDirectories: string[] = []

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    messageId: 'message-1',
    timestamp: '2026-05-20T12:31:05',
    channelName: 'Local',
    characterId: '9001',
    senderName: 'Capsuleer One',
    messageText: 'Hello there',
    messageType: 'chat',
    sessionFilePath: 'C:\\Users\\Ran\\Documents\\EVE\\logs\\Chatlogs\\Local_20260520_123000_9001.txt',
    translationStatus: 'idle',
    translatedText: null,
    errorMessage: null,
    ...overrides
  }
}

async function createRepository(maxMessages = 500) {
  const directoryPath = await mkdtemp(join(tmpdir(), 'eve-babel-repository-'))
  tempDirectories.push(directoryPath)
  const repository = new MessageRepository(join(directoryPath, 'messages.sqlite'), maxMessages)
  await repository.load()
  return { repository, directoryPath }
}

afterEach(async () => {
  while (tempDirectories.length > 0) {
    const directoryPath = tempDirectories.pop()
    if (directoryPath) {
      await rm(directoryPath, { recursive: true, force: true })
    }
  }
})

describe('MessageRepository', () => {
  it('preserves an existing translation when the same message is rescanned as idle', async () => {
    const { repository } = await createRepository()

    await repository.upsertMessages([
      createMessage({
        translationStatus: 'translated',
        translatedText: '你好',
        errorMessage: null
      })
    ])

    const [persistedMessage] = await repository.upsertMessages([
      createMessage({
        translationStatus: 'idle',
        translatedText: null,
        errorMessage: null
      })
    ])

    expect(persistedMessage).toMatchObject({
      translationStatus: 'translated',
      translatedText: '你好'
    })
    expect(repository.getRecentMessages('9001')).toEqual([persistedMessage])
  })

  it('persists translated messages across repository reloads', async () => {
    const { repository, directoryPath } = await createRepository()
    const repositoryPath = join(directoryPath, 'messages.sqlite')

    await repository.upsertMessages([
      createMessage({
        translationStatus: 'translated',
        translatedText: '已经翻译',
        errorMessage: null
      })
    ])

    const reloadedRepository = new MessageRepository(repositoryPath)
    await reloadedRepository.load()

    expect(reloadedRepository.getChannelMessages('9001', 'Local', 10)).toEqual({
      characterId: '9001',
      channelName: 'Local',
      messages: [
        expect.objectContaining({
          messageId: 'message-1',
          translationStatus: 'translated',
          translatedText: '已经翻译'
        })
      ],
      hasMore: false
    })
  })

  it('migrates legacy messages.json data into messages.sqlite on load', async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), 'eve-babel-repository-legacy-'))
    tempDirectories.push(directoryPath)
    const legacyFilePath = join(directoryPath, 'messages.json')

    await writeFile(
      legacyFilePath,
      JSON.stringify({
        messages: [
          createMessage({
            messageId: 'legacy-message',
            timestamp: '2026-05-20T12:40:00',
            translatedText: '旧译文',
            translationStatus: 'translated'
          })
        ]
      }),
      'utf8'
    )

    const repository = new MessageRepository(join(directoryPath, 'messages.sqlite'))
    await repository.load()

    expect(repository.getRecentMessages('9001')).toHaveLength(1)
    expect(repository.getRecentMessages('9001')[0]).toMatchObject({
      messageId: 'legacy-message',
      translatedText: '旧译文',
      translationStatus: 'translated'
    })
    await expect(readFile(`${legacyFilePath}.migrated`, 'utf8')).resolves.toContain('legacy-message')
  })

  it('keeps only the most recent messages within the configured cache size', async () => {
    const { repository } = await createRepository(2)

    await repository.upsertMessages([
      createMessage({ messageId: 'message-1', timestamp: '2026-05-20T12:31:00' }),
      createMessage({ messageId: 'message-2', timestamp: '2026-05-20T12:32:00' }),
      createMessage({ messageId: 'message-3', timestamp: '2026-05-20T12:33:00' })
    ])

    expect(repository.getRecentMessages('9001')).toEqual([
      expect.objectContaining({ messageId: 'message-2' }),
      expect.objectContaining({ messageId: 'message-3' })
    ])
  })

  it('returns channel messages in pages from newest to oldest', async () => {
    const { repository } = await createRepository()

    await repository.upsertMessages([
      createMessage({ messageId: 'message-1', timestamp: '2026-05-20T12:31:00' }),
      createMessage({ messageId: 'message-2', timestamp: '2026-05-20T12:32:00' }),
      createMessage({ messageId: 'message-3', timestamp: '2026-05-20T12:33:00' })
    ])

    const firstPage = repository.getChannelMessages('9001', 'Local', 2)

    expect(firstPage).toEqual({
      characterId: '9001',
      channelName: 'Local',
      messages: [
        expect.objectContaining({ messageId: 'message-2' }),
        expect.objectContaining({ messageId: 'message-3' })
      ],
      hasMore: true
    })

    const secondPage = repository.getChannelMessages('9001', 'Local', 2, {
      timestamp: firstPage.messages[0].timestamp,
      messageId: firstPage.messages[0].messageId
    })

    expect(secondPage).toEqual({
      characterId: '9001',
      channelName: 'Local',
      messages: [expect.objectContaining({ messageId: 'message-1' })],
      hasMore: false
    })
  })
})