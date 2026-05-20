import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { ChatMessage, ChatSessionFile } from '../../shared/types'
import { ChatLogParser } from './chatLogParser'
import { ChatLogWatcher } from './chatLogWatcher'

const tempDirectories: string[] = []
const activeWatchers: ChatLogWatcher[] = []

async function createTempDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(join(tmpdir(), 'eve-babel-watcher-'))
  tempDirectories.push(directoryPath)
  return directoryPath
}

async function writeUtf16Log(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, Buffer.from(content, 'utf16le'))
}

async function appendUtf16Log(filePath: string, content: string): Promise<void> {
  await appendFile(filePath, Buffer.from(content, 'utf16le'))
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_500): Promise<void> {
  const startedAt = Date.now()

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Condition was not met within ${timeoutMs}ms`)
    }

    await delay(20)
  }
}

afterEach(async () => {
  while (activeWatchers.length > 0) {
    const watcher = activeWatchers.pop()
    if (watcher) {
      await watcher.stop()
    }
  }

  while (tempDirectories.length > 0) {
    const directoryPath = tempDirectories.pop()
    if (directoryPath) {
      await rm(directoryPath, { recursive: true, force: true })
    }
  }
})

describe('ChatLogWatcher', () => {
  it('reads appended chat lines from an active session without requiring a refresh scan', async () => {
    const directoryPath = await createTempDirectory()
    const filePath = join(directoryPath, 'Local_20260520_130000_9001.txt')
    const capturedMessages: ChatMessage[] = []
    const session: ChatSessionFile = {
      absolutePath: filePath,
      channelName: 'Local',
      characterId: '9001',
      sessionStarted: '2026-05-20T13:00:00',
      lastReadOffset: 0,
      isActive: true,
      listenerName: 'Pilot One'
    }

    await writeUtf16Log(
      filePath,
      [
        'Channel ID: 1',
        'Channel Name: Local',
        'Listener: Pilot One',
        'Session started: 2026.05.20 13:00:00',
        '',
        '[ 2026.05.20 13:00:01 ] Existing Pilot > Already cached'
      ].join('\r\n') + '\r\n'
    )

    const watcher = new ChatLogWatcher(
      new ChatLogParser(),
      {
        onMessages: (messages) => {
          capturedMessages.push(...messages)
        },
        onStatus: () => {},
        onNewSessionFile: async () => null
      },
      { pollIntervalMs: 25 }
    )

    activeWatchers.push(watcher)

    await watcher.start(directoryPath, '9001', [session])

    await appendUtf16Log(filePath, '[ 2026.05.20 13:00:02 ] New Pilot > Fresh line\r\n')

    await waitFor(() => capturedMessages.length === 1)
    await delay(120)

    expect(capturedMessages).toHaveLength(1)
    expect(capturedMessages[0]).toMatchObject({
      channelName: 'Local',
      characterId: '9001',
      senderName: 'New Pilot',
      messageText: 'Fresh line',
      timestamp: '2026-05-20T13:00:02'
    })
  })
})