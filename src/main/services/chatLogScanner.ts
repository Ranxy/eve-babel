import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { ChannelSummary, CharacterSummary, ChatSessionFile, HeaderMetadata } from '../../shared/types'
import { extractHeaderMetadata } from './chatLogParser'

export interface ScanIndex {
  characters: CharacterSummary[]
  channelsByCharacter: Record<string, ChannelSummary[]>
  sessionsByCharacter: Record<string, ChatSessionFile[]>
}

interface FilenameParts {
  channelName: string
  characterId: string
  sessionStarted: string
}

function toSessionStarted(datePart: string, timePart: string): string {
  return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`
}

export function parseChatLogFilename(fileName: string): FilenameParts | null {
  const match = fileName.match(/^(.*)_(\d{8})_(\d{6})_(\d+)\.txt$/u)
  if (!match) {
    return null
  }

  const [, channelName, datePart, timePart, characterId] = match

  if (!channelName) {
    return null
  }

  return {
    channelName,
    characterId,
    sessionStarted: toSessionStarted(datePart, timePart)
  }
}

async function readHeaderMetadata(filePath: string): Promise<HeaderMetadata> {
  try {
    const buffer = await readFile(filePath)
    const preview = buffer.subarray(0, Math.min(buffer.length, 32_768)).toString('utf16le')
    return extractHeaderMetadata(preview)
  } catch {
    return {
      channelId: null,
      channelName: null,
      listenerName: null,
      sessionStarted: null
    }
  }
}

export class ChatLogScanner {
  async scanDirectory(directoryPath: string): Promise<ScanIndex> {
    const entries = await readdir(directoryPath, { withFileTypes: true })
    const sessionsByCharacter: Record<string, ChatSessionFile[]> = {}

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.txt')) {
        continue
      }

      const absolutePath = join(directoryPath, entry.name)
      const session = await this.hydrateSessionFile(absolutePath)
      if (!session) {
        continue
      }

      const sessions = sessionsByCharacter[session.characterId] ?? []
      sessions.push(session)
      sessionsByCharacter[session.characterId] = sessions
    }

    return this.buildIndexFromSessions(sessionsByCharacter)
  }

  async hydrateSessionFile(filePath: string): Promise<ChatSessionFile | null> {
    const fileName = filePath.split(/\\|\//u).at(-1)
    if (!fileName) {
      return null
    }

    const filenameParts = parseChatLogFilename(fileName)
    if (!filenameParts) {
      return null
    }

    const headerMetadata = await readHeaderMetadata(filePath)

    return {
      absolutePath: filePath,
      channelName: headerMetadata.channelName ?? filenameParts.channelName,
      characterId: filenameParts.characterId,
      sessionStarted: headerMetadata.sessionStarted ?? filenameParts.sessionStarted,
      lastReadOffset: 0,
      isActive: false,
      listenerName: headerMetadata.listenerName
    }
  }

  buildIndexFromSessions(sessionsByCharacter: Record<string, ChatSessionFile[]>, characterLabels: Record<string, string> = {}): ScanIndex {
    const characters: CharacterSummary[] = []
    const channelsByCharacter: Record<string, ChannelSummary[]> = {}
    const sessionIndex: Record<string, ChatSessionFile[]> = {}

    for (const [characterId, sessions] of Object.entries(sessionsByCharacter)) {
      const activeByChannel = new Map<string, ChatSessionFile>()

      for (const session of sessions) {
        const current = activeByChannel.get(session.channelName)
        if (!current || session.sessionStarted > current.sessionStarted) {
          activeByChannel.set(session.channelName, session)
        }
      }

      const activePaths = new Set(Array.from(activeByChannel.values()).map((session) => session.absolutePath))
      const hydratedSessions = sessions
        .map((session) => ({
          ...session,
          isActive: activePaths.has(session.absolutePath)
        }))
        .sort((left, right) => left.sessionStarted.localeCompare(right.sessionStarted))

      sessionIndex[characterId] = hydratedSessions
      channelsByCharacter[characterId] = Array.from(activeByChannel.values())
        .map((session) => ({
          channelName: session.channelName,
          enabled: false,
          pinned: false,
          messageCount: hydratedSessions.filter((item) => item.channelName === session.channelName).length,
          latestSessionStarted: session.sessionStarted,
          sourceCharacterId: characterId
        }))
        .sort((left, right) => left.channelName.localeCompare(right.channelName))

      let listenerName: string | null = null

      for (let index = hydratedSessions.length - 1; index >= 0; index -= 1) {
        const session = hydratedSessions[index]
        if (session.listenerName) {
          listenerName = session.listenerName
          break
        }
      }

      characters.push({
        characterId,
        label: listenerName ?? characterLabels[characterId] ?? characterId,
        recentActivityAt: hydratedSessions.at(-1)?.sessionStarted ?? null,
        availableChannelCount: channelsByCharacter[characterId].length,
        logFileCount: hydratedSessions.length
      })
    }

    characters.sort((left, right) => {
      const leftValue = left.recentActivityAt ?? ''
      const rightValue = right.recentActivityAt ?? ''
      return rightValue.localeCompare(leftValue)
    })

    return {
      characters,
      channelsByCharacter,
      sessionsByCharacter: sessionIndex
    }
  }
}