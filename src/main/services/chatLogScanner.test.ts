import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ChatLogScanner, parseChatLogFilename } from './chatLogScanner'

const tempDirectories: string[] = []

async function createTempDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(join(tmpdir(), 'eve-babel-scanner-'))
  tempDirectories.push(directoryPath)
  return directoryPath
}

async function writeUtf16Log(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, Buffer.from(content, 'utf16le'))
}

afterEach(async () => {
  while (tempDirectories.length > 0) {
    const directoryPath = tempDirectories.pop()
    if (directoryPath) {
      await rm(directoryPath, { recursive: true, force: true })
    }
  }
})

describe('parseChatLogFilename', () => {
  it('parses channel names from the right so spaces, dots, parentheses, and Chinese stay intact', () => {
    expect(parseChatLogFilename('Corp.Chat (CN) 中文_20260520_123000_9001.txt')).toEqual({
      channelName: 'Corp.Chat (CN) 中文',
      characterId: '9001',
      sessionStarted: '2026-05-20T12:30:00'
    })
  })

  it('returns null for unrelated files', () => {
    expect(parseChatLogFilename('notes.txt')).toBeNull()
  })
})

describe('ChatLogScanner', () => {
  it('builds a character-first index and marks the latest session of each channel as active', async () => {
    const directoryPath = await createTempDirectory()
    const localOldPath = join(directoryPath, 'Local_20260520_120000_9001.txt')
    const localNewPath = join(directoryPath, 'Local_20260520_130000_9001.txt')
    const corpPath = join(directoryPath, 'Corp.Chat (CN) 中文_20260520_123000_9002.txt')

    await writeUtf16Log(
      localOldPath,
      [
        'Channel ID: 1',
        'Channel Name: Local',
        'Listener: Pilot One',
        'Session started: 2026.05.20 12:00:00'
      ].join('\r\n')
    )
    await writeUtf16Log(
      localNewPath,
      [
        'Channel ID: 2',
        'Channel Name: Local',
        'Listener: Pilot One',
        'Session started: 2026.05.20 13:00:00'
      ].join('\r\n')
    )
    await writeUtf16Log(
      corpPath,
      [
        'Channel ID: 3',
        'Channel Name: Corp.Chat (CN) 中文',
        'Listener: Pilot Two',
        'Session started: 2026.05.20 12:30:00'
      ].join('\r\n')
    )

    const scanner = new ChatLogScanner()
    const result = await scanner.scanDirectory(directoryPath)

    expect(result.characters).toHaveLength(2)
    expect(result.characters[0]).toMatchObject({
      characterId: '9001',
      label: 'Pilot One',
      availableChannelCount: 1,
      logFileCount: 2,
      recentActivityAt: '2026-05-20T13:00:00'
    })
    expect(result.characters[1]).toMatchObject({
      characterId: '9002',
      label: 'Pilot Two',
      availableChannelCount: 1,
      logFileCount: 1
    })
    expect(result.channelsByCharacter['9001']).toEqual([
      {
        channelName: 'Local',
        enabled: false,
        pinned: false,
        messageCount: 2,
        latestSessionStarted: '2026-05-20T13:00:00',
        sourceCharacterId: '9001'
      }
    ])
    expect(result.sessionsByCharacter['9001'].filter((session) => session.isActive)).toHaveLength(1)
    expect(result.sessionsByCharacter['9001'].find((session) => session.isActive)?.absolutePath).toBe(localNewPath)
  })

  it('hydrates a single new session file for watcher-driven channel rollover', async () => {
    const directoryPath = await createTempDirectory()
    const rolloverPath = join(directoryPath, 'Alliance_20260520_140000_9001.txt')

    await writeUtf16Log(
      rolloverPath,
      [
        'Channel ID: 7',
        'Channel Name: Alliance',
        'Listener: Pilot One',
        'Session started: 2026.05.20 14:00:00'
      ].join('\r\n')
    )

    const scanner = new ChatLogScanner()
    const session = await scanner.hydrateSessionFile(rolloverPath)

    expect(session).toMatchObject({
      absolutePath: rolloverPath,
      channelName: 'Alliance',
      characterId: '9001',
      sessionStarted: '2026-05-20T14:00:00',
      listenerName: 'Pilot One',
      isActive: false
    })
  })
})