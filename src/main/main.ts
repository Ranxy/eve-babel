import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AppConfig, AppSettingsUpdate, BootstrapPayload, ChatMessage, ChannelSummary, ChatSessionFile } from '../shared/types'
import { registerIpcRouter, emitChannels, emitMessages, emitStatus } from './ipc/ipcRouter'
import { ChannelRegistry } from './services/channelRegistry'
import { CharacterRegistry } from './services/characterRegistry'
import { ChatLogParser } from './services/chatLogParser'
import { ChatLogScanner, parseChatLogFilename, type ScanIndex } from './services/chatLogScanner'
import { ChatLogWatcher } from './services/chatLogWatcher'
import { ConfigStore } from './services/configStore'
import { EvePathResolver } from './services/evePathResolver'
import { LlmClient } from './services/llmClient'
import { LlmConfigStore, type LlmConfigRecord } from './services/llmConfigStore'
import { MessageRepository } from './services/messageRepository'
import { TranslationQueue } from './services/translationQueue'

const currentDirectory = dirname(fileURLToPath(import.meta.url))

class EveBabelApp {
  private mainWindow: BrowserWindow | null = null
  private scanIndex: ScanIndex = {
    characters: [],
    channelsByCharacter: {},
    sessionsByCharacter: {}
  }

  private readonly configStore = new ConfigStore(ConfigStore.createDefaultFilePath(app.getPath('userData')))
  private readonly llmConfigStore = new LlmConfigStore(
    LlmConfigStore.createDefaultFilePath(app.getPath('userData')),
    ConfigStore.createDefaultFilePath(app.getPath('userData')),
    join(app.getPath('userData'), 'credentials.json')
  )
  private readonly messageRepository = new MessageRepository(MessageRepository.createDefaultFilePath(app.getPath('userData')))
  private readonly pathResolver = new EvePathResolver(app.getPath('documents'))
  private readonly scanner = new ChatLogScanner()
  private readonly parser = new ChatLogParser()
  private readonly characterRegistry = new CharacterRegistry()
  private readonly channelRegistry = new ChannelRegistry()
  private readonly translationQueue = new TranslationQueue(
    new LlmClient(),
    this.llmConfigStore,
    this.messageRepository,
    {
      onMessageUpdated: (message) => this.publishMessages([message]),
      onApiStatusChanged: () => this.publishStatus()
    }
  )

  private readonly watcher = new ChatLogWatcher(this.parser, {
    onMessages: (messages) => {
      void this.handleWatcherMessages(messages)
    },
    onStatus: () => this.publishStatus(),
    onNewSessionFile: (filePath) => this.hydrateSessionFromPath(filePath)
  })

  private config: AppConfig = {
    logDirectory: null,
    selectedCharacterId: null,
    enabledChannels: {},
    targetLanguage: 'zh-CN',
    apiBaseUrl: '',
    modelName: '',
    debounceMs: 350,
    maxQueueSize: 100
  }

  async initialize(): Promise<void> {
    const persistedConfig = await this.configStore.load()
    const llmConfig = await this.llmConfigStore.load()
    this.config = this.composeRuntimeConfig(persistedConfig, llmConfig)
    await this.messageRepository.load()
    await this.translationQueue.refreshConfiguration(this.config)
    await this.refreshScan()
  }

  async createWindow(): Promise<void> {
    this.mainWindow = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 1160,
      minHeight: 760,
      backgroundColor: '#e7dfd2',
      webPreferences: {
        preload: join(currentDirectory, '../preload/preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.configureMenu()

    if (process.env.ELECTRON_RENDERER_URL) {
      await this.mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      await this.mainWindow.loadFile(join(currentDirectory, '../renderer/index.html'))
    }
  }

  async getBootstrapData(): Promise<BootstrapPayload> {
    const selectedCharacterId = this.characterRegistry.getSelectedCharacterId()

    return {
      directoryStatus: this.pathResolver.resolveDirectory(this.config.logDirectory),
      config: this.config,
      characters: this.characterRegistry.getCharacters(),
      channels: this.channelRegistry.getChannels(selectedCharacterId),
      recentMessages: this.messageRepository.getRecentMessages(selectedCharacterId),
      watcherStatus: this.watcher.getStatus(),
      apiStatus: this.translationQueue.getStatus()
    }
  }

  async refreshScan(): Promise<BootstrapPayload> {
    const directoryStatus = this.pathResolver.resolveDirectory(this.config.logDirectory)

    if (!directoryStatus.exists || !directoryStatus.path) {
      this.scanIndex = {
        characters: [],
        channelsByCharacter: {},
        sessionsByCharacter: {}
      }
      this.characterRegistry.setCharacters([], null)
      this.channelRegistry.setChannels({}, this.config.enabledChannels)
      await this.watcher.stop()
      return this.getBootstrapData()
    }

    this.scanIndex = await this.scanner.scanDirectory(directoryStatus.path)
    this.characterRegistry.setCharacters(this.scanIndex.characters, this.config.selectedCharacterId)
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels)

    const selectedCharacterId = this.characterRegistry.getSelectedCharacterId()
    if (selectedCharacterId) {
      await this.startCharacterSession(selectedCharacterId)
    } else {
      await this.watcher.stop()
    }

    this.publishChannels()
    this.publishStatus()
    return this.getBootstrapData()
  }

  async setLogDirectory(directory: string): Promise<BootstrapPayload> {
    this.config = this.mergeAppConfig(await this.configStore.update({ logDirectory: directory }))
    await this.translationQueue.refreshConfiguration(this.config)
    return this.refreshScan()
  }

  async selectCharacter(characterId: string): Promise<BootstrapPayload> {
    this.characterRegistry.selectCharacter(characterId)
    this.config = this.mergeAppConfig(await this.configStore.update({ selectedCharacterId: characterId }))
    await this.startCharacterSession(characterId)
    this.publishChannels()
    this.publishStatus()
    return this.getBootstrapData()
  }

  async setChannelEnabled(channelName: string, enabled: boolean): Promise<BootstrapPayload> {
    const characterId = this.characterRegistry.getSelectedCharacterId()
    if (!characterId) {
      return this.getBootstrapData()
    }

    this.config = this.mergeAppConfig(await this.configStore.setChannelEnabled(characterId, channelName, enabled))
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels)
    this.publishChannels()
    return this.getBootstrapData()
  }

  async updateSettings(update: AppSettingsUpdate): Promise<BootstrapPayload> {
    const nextAppConfig = await this.configStore.update(this.extractNonLlmPatch(update.config))
    const nextLlmConfig = await this.llmConfigStore.update({
      apiBaseUrl: update.config.apiBaseUrl,
      modelName: update.config.modelName,
      apiKey: update.apiKey
    })

    this.config = this.composeRuntimeConfig(nextAppConfig, nextLlmConfig)
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels)
    await this.translationQueue.refreshConfiguration(this.config)

    if (this.translationQueue.getStatus().configured) {
      await this.enqueueEligibleTranslations(this.messageRepository.getRecentMessages(this.characterRegistry.getSelectedCharacterId()))
    }

    this.publishStatus()
    return this.getBootstrapData()
  }

  private async startCharacterSession(characterId: string): Promise<void> {
    const sessions = this.scanIndex.sessionsByCharacter[characterId] ?? []
    const activeSessions = this.getActiveSessions(characterId)
    await this.seedRecentMessages(activeSessions)

    const directoryStatus = this.pathResolver.resolveDirectory(this.config.logDirectory)
    if (directoryStatus.path) {
      await this.watcher.start(directoryStatus.path, characterId, activeSessions)
    }
  }

  private getActiveSessions(characterId: string): ChatSessionFile[] {
    return (this.scanIndex.sessionsByCharacter[characterId] ?? []).filter((session) => session.isActive)
  }

  private async seedRecentMessages(sessions: ChatSessionFile[]): Promise<void> {
    const allMessages: ChatMessage[] = []

    for (const session of sessions) {
      try {
        const buffer = await readFile(session.absolutePath)
        const parsed = this.parser.parseChunk(buffer.toString('utf16le'), session)
        allMessages.push(...parsed.messages)
      } catch {
        continue
      }
    }

    if (allMessages.length === 0) {
      return
    }

    const deduplicatedMessages = await this.messageRepository.upsertMessages(allMessages)
    this.publishMessages(deduplicatedMessages)
    await this.enqueueEligibleTranslations(deduplicatedMessages)
  }

  private async handleWatcherMessages(messages: ChatMessage[]): Promise<void> {
    const persistedMessages = await this.messageRepository.upsertMessages(messages)
    this.publishMessages(persistedMessages)
    await this.enqueueEligibleTranslations(persistedMessages)
  }

  private async hydrateSessionFromPath(filePath: string): Promise<ChatSessionFile | null> {
    const fileName = filePath.split(/\\|\//u).at(-1)
    if (!fileName) {
      return null
    }

    const parsed = parseChatLogFilename(fileName)
    if (!parsed) {
      return null
    }

    const nextScan = await this.refreshScan()
    const sessions = this.scanIndex.sessionsByCharacter[parsed.characterId] ?? []
    const session = sessions.find((item) => item.absolutePath === filePath) ?? null

    if (nextScan.config.selectedCharacterId === parsed.characterId) {
      this.publishChannels()
    }

    return session
  }

  private isChannelEnabled(characterId: string, channelName: string): boolean {
    return (this.config.enabledChannels[characterId] ?? []).includes(channelName)
  }

  private composeRuntimeConfig(config: AppConfig, llmConfig: LlmConfigRecord): AppConfig {
    return {
      ...config,
      apiBaseUrl: llmConfig.apiBaseUrl,
      modelName: llmConfig.modelName
    }
  }

  private mergeAppConfig(config: AppConfig): AppConfig {
    return {
      ...config,
      apiBaseUrl: this.config.apiBaseUrl,
      modelName: this.config.modelName
    }
  }

  private extractNonLlmPatch(config: Partial<AppConfig>): Partial<AppConfig> {
    const { apiBaseUrl: _apiBaseUrl, modelName: _modelName, ...rest } = config
    return rest
  }

  private async enqueueEligibleTranslations(messages: ChatMessage[]): Promise<void> {
    if (!this.translationQueue.getStatus().configured) {
      return
    }

    for (const message of messages) {
      if (message.messageType !== 'chat' || !this.isChannelEnabled(message.characterId, message.channelName)) {
        continue
      }

      if (message.translationStatus === 'translated') {
        continue
      }

      await this.translationQueue.enqueue(message, this.config)
    }
  }

  private publishMessages(messages?: ChatMessage[]): void {
    if (!this.mainWindow || !messages || messages.length === 0) {
      return
    }

    emitMessages(this.mainWindow, messages)
  }

  private publishChannels(): void {
    if (!this.mainWindow) {
      return
    }

    emitChannels(this.mainWindow, this.channelRegistry.getChannels(this.characterRegistry.getSelectedCharacterId()))
  }

  private publishStatus(): void {
    if (!this.mainWindow) {
      return
    }

    emitStatus(this.mainWindow, {
      directoryStatus: this.pathResolver.resolveDirectory(this.config.logDirectory),
      watcherStatus: this.watcher.getStatus(),
      apiStatus: this.translationQueue.getStatus()
    })
  }

  private configureMenu(): void {
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Settings',
            accelerator: 'CmdOrCtrl+,',
            click: () => this.openSettingsPage()
          },
          { type: 'separator' },
          { role: process.platform === 'darwin' ? 'close' : 'quit' }
        ]
      },
      {
        label: 'View',
        submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'toggleDevTools' }]
      }
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }

  private openSettingsPage(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    this.mainWindow.webContents.send('app:openSettings')
    this.mainWindow.focus()
  }
}

const eveBabelApp = new EveBabelApp()

app.whenReady().then(async () => {
  await eveBabelApp.initialize()
  registerIpcRouter({
    getBootstrapData: () => eveBabelApp.getBootstrapData(),
    refreshScan: () => eveBabelApp.refreshScan(),
    setLogDirectory: (directory) => eveBabelApp.setLogDirectory(directory),
    selectCharacter: (characterId) => eveBabelApp.selectCharacter(characterId),
    setChannelEnabled: (channelName, enabled) => eveBabelApp.setChannelEnabled(channelName, enabled),
    updateSettings: (update) => eveBabelApp.updateSettings(update)
  })
  await eveBabelApp.createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await eveBabelApp.createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})