import { describe, expect, it } from 'vitest'

import type { ChatSessionFile } from '../../shared/types'
import { ChatLogParser, extractHeaderMetadata } from './chatLogParser'

function createSession(overrides: Partial<ChatSessionFile> = {}): ChatSessionFile {
  return {
    absolutePath: 'C:\\Users\\Ran\\Documents\\EVE\\logs\\Chatlogs\\Local_20260520_123000_9001.txt',
    channelName: 'Local',
    characterId: '9001',
    sessionStarted: '2026-05-20T12:30:00',
    lastReadOffset: 0,
    isActive: true,
    listenerName: 'Pilot One',
    ...overrides
  }
}

describe('extractHeaderMetadata', () => {
  it('parses header fields from UTF-16LE-decoded text with repeated BOM markers', () => {
    const content = [
      '\uFEFFChannel ID: 12345',
      '\uFEFFChannel Name: Local',
      'Listener: Pilot One',
      'Session started: 2026.05.20 12:30:00',
      '[ 2026.05.20 12:31:00 ] EVE System > Channel changed to Local : Jita'
    ].join('\r\n')

    expect(extractHeaderMetadata(content)).toEqual({
      channelId: '12345',
      channelName: 'Local',
      listenerName: 'Pilot One',
      sessionStarted: '2026-05-20T12:30:00'
    })
  })
})

describe('ChatLogParser', () => {
  it('parses chat and system messages while stripping line-level BOM markers', () => {
    const parser = new ChatLogParser()
    const session = createSession()
    const content = [
      '\uFEFFChannel ID: 12345',
      'Channel Name: Local',
      'Listener: Pilot One',
      'Session started: 2026.05.20 12:30:00',
      '',
      '\uFEFF[ 2026.05.20 12:31:00 ] EVE System > Channel changed to Local : Jita',
      '\uFEFF[ 2026.05.20 12:31:05 ] Capsuleer One > Hello there'
    ].join('\r\n') + '\r\n'

    const result = parser.parseChunk(content, session)

    expect(result.leftoverText).toBe('')
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]).toMatchObject({
      channelName: 'Local',
      characterId: '9001',
      senderName: 'EVE System',
      messageType: 'system',
      translationStatus: 'skipped'
    })
    expect(result.messages[1]).toMatchObject({
      senderName: 'Capsuleer One',
      messageText: 'Hello there',
      messageType: 'chat',
      translationStatus: 'idle'
    })
  })

  it('keeps incomplete trailing lines as leftover text for the next chunk', () => {
    const parser = new ChatLogParser()
    const session = createSession()

    const firstChunk = parser.parseChunk(
      '[ 2026.05.20 12:31:05 ] Capsuleer One > Hello\n[ 2026.05.20 12:31:06 ] Capsuleer Two > Par',
      session
    )
    const secondChunk = parser.parseChunk('tial line completed\n', session, firstChunk.leftoverText)

    expect(firstChunk.messages).toHaveLength(1)
    expect(firstChunk.leftoverText).toBe('[ 2026.05.20 12:31:06 ] Capsuleer Two > Par')
    expect(secondChunk.messages).toHaveLength(1)
    expect(secondChunk.messages[0]).toMatchObject({
      senderName: 'Capsuleer Two',
      messageText: 'Partial line completed'
    })
  })
})