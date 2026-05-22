import { createHash } from 'node:crypto'

import type { ChatMessage, ChatSessionFile, HeaderMetadata, ParsedChunkResult } from '../../shared/types'

const TIMESTAMP_PREFIX = /^\[\s*(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})\s*\]\s*(.+?)\s*>\s*(.*)$/u
const HEADER_LINE = /^(Channel ID|Channel Name|Listener|Session started):\s*(.*)$/u

function toIsoTimestamp(rawValue: string): string {
  const [datePart, timePart] = rawValue.trim().split(/\s+/u)
  const normalizedDate = datePart.replace(/\./gu, '-')
  return `${normalizedDate}T${timePart}`
}

function buildMessageId(sessionFilePath: string, timestamp: string, senderName: string, messageText: string): string {
  return createHash('sha1')
    .update(`${sessionFilePath}|${timestamp}|${senderName}|${messageText}`)
    .digest('hex')
}

export function extractHeaderMetadata(content: string): HeaderMetadata {
  const lines = content.replace(/\r\n/gu, '\n').split('\n')
  const metadata: HeaderMetadata = {
    channelId: null,
    channelName: null,
    listenerName: null,
    sessionStarted: null
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF+/u, '').trim()
    if (!line) {
      continue
    }

    const headerMatch = line.match(HEADER_LINE)
    if (!headerMatch) {
      if (TIMESTAMP_PREFIX.test(line)) {
        break
      }
      continue
    }

    const [, key, value] = headerMatch

    if (key === 'Channel ID') {
      metadata.channelId = value.trim() || null
    }

    if (key === 'Channel Name') {
      metadata.channelName = value.trim() || null
    }

    if (key === 'Listener') {
      metadata.listenerName = value.trim() || null
    }

    if (key === 'Session started') {
      metadata.sessionStarted = value.trim() ? toIsoTimestamp(value) : null
    }
  }

  return metadata
}

export class ChatLogParser {
  parseChunk(chunkText: string, session: ChatSessionFile, leftoverText = ''): ParsedChunkResult {
    const normalized = `${leftoverText}${chunkText}`.replace(/\r\n/gu, '\n')
    const lines = normalized.split('\n')
    const trailingPartial = normalized.endsWith('\n') ? '' : lines.pop() ?? ''
    const messages: ChatMessage[] = []
    let messageSectionStarted = false

    for (const rawLine of lines) {
      const line = rawLine.replace(/^\uFEFF+/u, '').trim()

      if (!line) {
        continue
      }

      const messageMatch = line.match(TIMESTAMP_PREFIX)
      if (!messageMatch) {
        if (!messageSectionStarted) {
          continue
        }
        continue
      }

      messageSectionStarted = true

      const [, rawTimestamp, senderName, messageText] = messageMatch
      const timestamp = toIsoTimestamp(rawTimestamp)
      const messageType = senderName === 'EVE System' || senderName === 'Message' ? 'system' : 'chat'
      const normalizedText = messageText.trim()

      if (!normalizedText) {
        continue
      }

      messages.push({
        messageId: buildMessageId(session.absolutePath, timestamp, senderName.trim(), normalizedText),
        timestamp,
        channelName: session.channelName,
        characterId: session.characterId,
        senderName: senderName.trim(),
        messageText: normalizedText,
        messageType,
        sessionFilePath: session.absolutePath,
        translationStatus: messageType === 'chat' ? 'idle' : 'skipped',
        translatedText: null,
        errorMessage: null
      })
    }

    return {
      messages,
      leftoverText: trailingPartial
    }
  }
}