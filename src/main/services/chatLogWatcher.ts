import { open, stat } from 'node:fs/promises'

import chokidar, { type FSWatcher } from 'chokidar'

import type { ChatMessage, ChatSessionFile, WatcherStatus } from '../../shared/types'
import { ChatLogParser } from './chatLogParser'
import { parseChatLogFilename } from './chatLogScanner'

const DEFAULT_POLL_INTERVAL_MS = 500

interface FileState {
  offset: number
  leftoverText: string
}

interface WatcherCallbacks {
  onMessages: (messages: ChatMessage[]) => void
  onStatus: (status: WatcherStatus) => void
  onNewSessionFile: (filePath: string) => Promise<ChatSessionFile | null>
}

export class ChatLogWatcher {
  private watcher: FSWatcher | null = null
  private activeSessions = new Map<string, ChatSessionFile>()
  private fileState = new Map<string, FileState>()
  private activeReads = new Set<string>()
  private directoryPath: string | null = null
  private currentCharacterId: string | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private status: WatcherStatus = {
    state: 'idle',
    watchedChannels: 0,
    activeFiles: 0,
    lastEventAt: null,
    lastError: null
  }

  constructor(
    private readonly parser: ChatLogParser,
    private readonly callbacks: WatcherCallbacks,
    private readonly options: { pollIntervalMs?: number } = {}
  ) {}

  getStatus(): WatcherStatus {
    return { ...this.status }
  }

  async start(directoryPath: string, characterId: string, activeSessions: ChatSessionFile[]): Promise<void> {
    await this.stop()

    this.directoryPath = directoryPath
    this.currentCharacterId = characterId
    this.activeSessions = new Map(activeSessions.map((session) => [session.absolutePath, session]))
    this.fileState = new Map()

    for (const session of activeSessions) {
      const fileStats = await stat(session.absolutePath).catch(() => null)
      const initialOffset = fileStats ? fileStats.size - (fileStats.size % 2) : 0
      this.fileState.set(session.absolutePath, { offset: initialOffset, leftoverText: '' })
    }

    this.watcher = chokidar.watch(directoryPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 50
      }
    })

    this.watcher.on('add', (filePath) => {
      void this.handleFileAdded(filePath)
    })

    this.watcher.on('change', (filePath) => {
      void this.handleFileChanged(filePath)
    })

    this.watcher.on('error', (error) => {
      this.publishStatus({
        state: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown watcher error'
      })
    })

    this.startPolling()

    this.publishStatus({
      state: 'watching',
      watchedChannels: activeSessions.length,
      activeFiles: activeSessions.length,
      lastError: null
    })
  }

  async stop(): Promise<void> {
    this.stopPolling()

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    this.activeSessions.clear()
    this.activeReads.clear()
    this.fileState.clear()
    this.publishStatus({
      state: 'idle',
      watchedChannels: 0,
      activeFiles: 0,
      lastEventAt: null,
      lastError: null
    })
  }

  private async handleFileAdded(filePath: string): Promise<void> {
    if (!this.directoryPath || !this.currentCharacterId) {
      return
    }

    const fileName = filePath.split(/\\|\//u).at(-1)
    if (!fileName) {
      return
    }

    const parsed = parseChatLogFilename(fileName)
    if (!parsed || parsed.characterId !== this.currentCharacterId) {
      return
    }

    const nextSession = await this.callbacks.onNewSessionFile(filePath)
    if (!nextSession) {
      return
    }

    const currentChannelSession = Array.from(this.activeSessions.values()).find(
      (session) => session.channelName === nextSession.channelName
    )

    if (!currentChannelSession || nextSession.sessionStarted >= currentChannelSession.sessionStarted) {
      if (currentChannelSession) {
        this.activeSessions.delete(currentChannelSession.absolutePath)
        this.fileState.delete(currentChannelSession.absolutePath)
      }

      this.activeSessions.set(nextSession.absolutePath, nextSession)
      this.fileState.set(nextSession.absolutePath, { offset: 0, leftoverText: '' })

      this.publishStatus({
        state: 'watching',
        watchedChannels: this.activeSessions.size,
        activeFiles: this.activeSessions.size,
        lastEventAt: new Date().toISOString(),
        lastError: null
      })

      await this.handleFileChanged(nextSession.absolutePath)
    }
  }

  private async handleFileChanged(filePath: string): Promise<void> {
    const session = this.activeSessions.get(filePath)
    if (!session || this.activeReads.has(filePath)) {
      return
    }

    this.activeReads.add(filePath)

    try {
      const fileStats = await stat(filePath)
      const currentState = this.fileState.get(filePath) ?? { offset: 0, leftoverText: '' }
      let nextOffset = currentState.offset

      if (fileStats.size < nextOffset) {
        nextOffset = 0
      }

      const length = fileStats.size - nextOffset
      if (length <= 0) {
        return
      }

      const readableLength = length - (length % 2)
      if (readableLength <= 0) {
        return
      }

      const buffer = Buffer.alloc(readableLength)
      const fileHandle = await open(filePath, 'r')

      try {
        await fileHandle.read(buffer, 0, buffer.length, nextOffset)
      } finally {
        await fileHandle.close()
      }

      const decodedText = buffer.toString('utf16le')
      const parsed = this.parser.parseChunk(decodedText, session, currentState.leftoverText)

      this.fileState.set(filePath, {
        offset: nextOffset + buffer.length,
        leftoverText: parsed.leftoverText
      })

      if (parsed.messages.length > 0) {
        this.callbacks.onMessages(parsed.messages)
        this.publishStatus({
          state: 'watching',
          watchedChannels: this.activeSessions.size,
          activeFiles: this.activeSessions.size,
          lastEventAt: new Date().toISOString(),
          lastError: null
        })
      }
    } catch (error) {
      this.publishStatus({
        state: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown read error'
      })
    } finally {
      this.activeReads.delete(filePath)
    }
  }

  private startPolling(): void {
    this.stopPolling()

    if (this.activeSessions.size === 0) {
      return
    }

    this.pollTimer = setInterval(() => {
      void this.pollActiveSessions()
    }, this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)

    this.pollTimer.unref?.()
  }

  private stopPolling(): void {
    if (!this.pollTimer) {
      return
    }

    clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  private async pollActiveSessions(): Promise<void> {
    const activeFilePaths = Array.from(this.activeSessions.keys())

    for (const filePath of activeFilePaths) {
      await this.handleFileChanged(filePath)
    }
  }

  private publishStatus(update: Partial<WatcherStatus>): void {
    this.status = {
      ...this.status,
      ...update
    }
    this.callbacks.onStatus(this.getStatus())
  }
}