import { randomUUID } from 'node:crypto'
import { app, BrowserWindow, Menu, nativeTheme, protocol, screen, shell, type MenuItemConstructorOptions } from 'electron'
import { mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_TARGET_LANGUAGE,
  DEFAULT_TRANSLATION_PROMPT,
  type AppConfig,
  type AppSettingsUpdate,
  type BootstrapPayload,
  type ChannelMessagePage,
  type ChatMessage,
  type ChannelSummary,
  type ChatSessionFile,
  type FetchLlmProviderModelsInput,
  type GlossaryEntry,
  type MessagePageCursor,
  type SaveLlmProviderProfileInput
} from '../shared/types'
import { registerIpcRouter, emitChannels, emitMessages, emitPortraits, emitStatus } from './ipc/ipcRouter'
import { ChannelRegistry } from './services/channelRegistry'
import { CharacterRegistry } from './services/characterRegistry'
import { CharacterPortraitService } from './services/characterPortraitService'
import { ChatLogParser } from './services/chatLogParser'
import { ChatLogScanner, parseChatLogFilename, type ScanIndex } from './services/chatLogScanner'
import { ChatLogWatcher } from './services/chatLogWatcher'
import { ConfigStore } from './services/configStore'
import { EvePathResolver } from './services/evePathResolver'
import { selectHistoryMessagesForTranslation } from './services/historyTranslationSelector'
import { LlmDebugLogger } from './services/llmDebugLogger'
import { LlmClient } from './services/llmClient'
import { LlmConfigStore, type LlmResolvedConfig } from './services/llmConfigStore'
import { fetchBuiltinProviderModels, getBuiltinLlmProviders } from './services/llmProviderCatalog'
import { MessageRepository } from './services/messageRepository'
import { TranslationQueue } from './services/translationQueue'
import { WindowStateStore, type WindowKind, type WindowStateSnapshot } from './services/windowStateStore'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CHANNEL_PAGE_SIZE = 10
const HISTORY_TRANSLATION_BACKFILL_LIMIT = 10

class EveBabelApp {
  private mainWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null
  private overlayWindow: BrowserWindow | null = null
  private scanIndex: ScanIndex = {
    characters: [],
    channelsByCharacter: {},
    sessionsByCharacter: {}
  }

  private readonly configStore = new ConfigStore(ConfigStore.createDefaultFilePath(app.getPath('userData')))
  private readonly windowStateStore = new WindowStateStore(WindowStateStore.createDefaultFilePath(app.getPath('userData')))
  private readonly llmConfigStore = new LlmConfigStore(
    LlmConfigStore.createDefaultFilePath(app.getPath('userData')),
    ConfigStore.createDefaultFilePath(app.getPath('userData')),
    join(app.getPath('userData'), 'credentials.json')
  )
  private readonly messageRepository = new MessageRepository(MessageRepository.createDefaultFilePath(app.getPath('userData')))
  private readonly portraitsDirectory = join(app.getPath('userData'), 'portraits')
  private readonly portraitService = new CharacterPortraitService(this.messageRepository, this.portraitsDirectory)
  private readonly pathResolver = new EvePathResolver(app.getPath('documents'))
  private readonly scanner = new ChatLogScanner()
  private readonly parser = new ChatLogParser()
  private readonly characterRegistry = new CharacterRegistry()
  private readonly channelRegistry = new ChannelRegistry()
  private readonly translationQueue = new TranslationQueue(
    new LlmClient(new LlmDebugLogger(LlmDebugLogger.createDefaultDirectory(app.getPath('userData')))),
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
    pinnedChannels: {},
    llmDebugEnabled: false,
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    translationPrompt: DEFAULT_TRANSLATION_PROMPT,
    activeProviderId: null,
    apiBaseUrl: '',
    modelName: '',
    debounceMs: 350,
    maxQueueSize: 100,
    glossary: []
  }

  async initialize(): Promise<void> {
    this.registerPortraitProtocol()

    const persistedConfig = await this.configStore.load()
    const llmConfig = await this.llmConfigStore.load()
    await this.windowStateStore.load()
    this.config = this.composeRuntimeConfig(persistedConfig, llmConfig.resolvedConfig)
    await this.messageRepository.load()
    await this.translationQueue.refreshConfiguration(this.config)
    await this.refreshScan()
  }

  async createWindow(): Promise<void> {
    const bounds = this.resolveWindowBounds('main', {
      width: 1440,
      height: 920,
      minWidth: 1160,
      minHeight: 760
    })

    this.mainWindow = new BrowserWindow({
      ...bounds,
      minWidth: 1160,
      minHeight: 760,
      show: false,
      title: 'EVE Babel',
      backgroundColor: this.getWindowBackgroundColor(),
      webPreferences: {
        preload: join(currentDirectory, '../preload/preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })
    this.configureNativeWindow(this.mainWindow, 'main')

    this.configureMenu()
    await this.loadRendererView(this.mainWindow, 'main')
  }

  async openSettingsWindow(): Promise<void> {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isMinimized()) {
        this.settingsWindow.restore()
      }

      this.settingsWindow.focus()
      return
    }

    const bounds = this.resolveWindowBounds('settings', {
      width: 720,
      height: 760,
      minWidth: 620,
      minHeight: 680
    })

    this.settingsWindow = new BrowserWindow({
      ...bounds,
      minWidth: 620,
      minHeight: 680,
      show: false,
      title: 'EVE Babel Settings',
      backgroundColor: this.getWindowBackgroundColor(),
      parent: this.mainWindow ?? undefined,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(currentDirectory, '../preload/preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null
    })
    this.configureNativeWindow(this.settingsWindow, 'settings')

    await this.loadRendererView(this.settingsWindow, 'settings')
  }

  async openOverlayWindow(channelName: string): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus()
      return
    }

    const bounds = this.resolveWindowBounds('overlay', {
      width: 400,
      height: 632,
      minWidth: 280,
      minHeight: 232
    })

    this.overlayWindow = new BrowserWindow({
      ...bounds,
      minWidth: 280,
      minHeight: 232,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      show: false,
      title: 'EVE Babel Overlay',
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(currentDirectory, '../preload/preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })

    this.overlayWindow.setHasShadow(false)
    this.installWindowStatePersistence(this.overlayWindow, 'overlay')

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null
    })

    await this.loadRendererView(this.overlayWindow, 'overlay', channelName)
    this.overlayWindow.show()
  }

  async closeOverlayWindow(): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.close()
    }

    this.overlayWindow = null
  }

  async resizeOverlayBody(deltaY: number): Promise<void> {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return
    }

    const [bx, by] = this.overlayWindow.getPosition()
    const [bw, bh] = this.overlayWindow.getSize()
    const newHeight = Math.max(bh + deltaY, 232)
    this.overlayWindow.setBounds({ x: bx, y: by, width: bw, height: newHeight })
  }

  async getBootstrapData(): Promise<BootstrapPayload> {
    const selectedCharacterId = this.characterRegistry.getSelectedCharacterId()

    return {
      directoryStatus: this.pathResolver.resolveDirectory(this.config.logDirectory),
      config: this.config,
      llmProviderState: this.buildLlmProviderState(),
      characters: this.characterRegistry.getCharacters(),
      channels: this.channelRegistry.getChannels(selectedCharacterId),
      recentMessages: this.messageRepository.getRecentMessages(selectedCharacterId),
      watcherStatus: this.watcher.getStatus(),
      apiStatus: this.translationQueue.getStatus(),
      portraits: this.portraitService.getAllPortraits()
    }
  }

  async getChannelMessages(
    channelName: string,
    before: MessagePageCursor | null = null,
    limit = DEFAULT_CHANNEL_PAGE_SIZE
  ): Promise<ChannelMessagePage> {
    const selectedCharacterId = this.characterRegistry.getSelectedCharacterId()

    if (!selectedCharacterId) {
      return {
        characterId: '',
        channelName,
        messages: [],
        hasMore: false
      }
    }

    const page = this.messageRepository.getChannelMessages(selectedCharacterId, channelName, limit, before ?? undefined)

    const senderNames = [...new Set(page.messages.filter((m) => m.messageType === 'chat').map((m) => m.senderName))]
    void this.portraitService.resolvePortraits(senderNames, (portraits) => {
      this.publishPortraits(portraits)
    })

    return page
  }

  async cancelQueuedTranslations(): Promise<BootstrapPayload> {
    await this.translationQueue.cancelQueued()
    this.publishStatus()
    return this.getBootstrapData()
  }

  async openLlmDebugFolder(): Promise<void> {
    const directoryPath = LlmDebugLogger.createDefaultDirectory(app.getPath('userData'))
    await mkdir(directoryPath, { recursive: true })

    const errorMessage = await shell.openPath(directoryPath)
    if (errorMessage) {
      throw new Error(errorMessage)
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
      this.channelRegistry.setChannels({}, this.config.enabledChannels, this.config.pinnedChannels)
      await this.watcher.stop()
      return this.getBootstrapData()
    }

    this.scanIndex = await this.scanner.scanDirectory(directoryStatus.path)
    this.characterRegistry.setCharacters(this.scanIndex.characters, this.config.selectedCharacterId)
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels, this.config.pinnedChannels)

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
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels, this.config.pinnedChannels)

    if (enabled) {
      await this.enqueueChannelHistoryTranslations(characterId, channelName)
    }

    this.publishChannels()
    return this.getBootstrapData()
  }

  async setChannelPinned(channelName: string, pinned: boolean): Promise<BootstrapPayload> {
    const characterId = this.characterRegistry.getSelectedCharacterId()
    if (!characterId) {
      return this.getBootstrapData()
    }

    this.config = this.mergeAppConfig(await this.configStore.setChannelPinned(characterId, channelName, pinned))
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels, this.config.pinnedChannels)
    this.publishChannels()
    return this.getBootstrapData()
  }

  async updateSettings(update: AppSettingsUpdate): Promise<BootstrapPayload> {
    const nextAppConfig = await this.configStore.update(this.extractNonLlmPatch(update.config))

    this.config = this.composeRuntimeConfig(nextAppConfig, this.llmConfigStore.getActiveResolvedConfig())
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels, this.config.pinnedChannels)
    await this.translationQueue.refreshConfiguration(this.config)

    if (this.translationQueue.getStatus().configured) {
      await this.enqueueHistoryTranslationsForEnabledChannels(this.characterRegistry.getSelectedCharacterId())
    }

    this.publishStatus()
    return this.getBootstrapData()
  }

  async saveLlmProviderProfile(input: SaveLlmProviderProfileInput): Promise<BootstrapPayload> {
    const nextSnapshot = await this.llmConfigStore.saveProfile(input)
    this.config = this.composeRuntimeConfig(this.configStore.getConfig(), nextSnapshot.resolvedConfig)
    await this.translationQueue.refreshConfiguration(this.config)

    if (this.translationQueue.getStatus().configured) {
      await this.enqueueHistoryTranslationsForEnabledChannels(this.characterRegistry.getSelectedCharacterId())
    }

    this.publishStatus()
    return this.getBootstrapData()
  }

  async setActiveLlmProviderProfile(profileId: string): Promise<BootstrapPayload> {
    const nextSnapshot = await this.llmConfigStore.setActiveProfile(profileId)
    this.config = this.composeRuntimeConfig(this.configStore.getConfig(), nextSnapshot.resolvedConfig)
    await this.translationQueue.refreshConfiguration(this.config)

    if (this.translationQueue.getStatus().configured) {
      await this.enqueueHistoryTranslationsForEnabledChannels(this.characterRegistry.getSelectedCharacterId())
    }

    this.publishStatus()
    return this.getBootstrapData()
  }

  async deleteLlmProviderProfile(profileId: string): Promise<BootstrapPayload> {
    const nextSnapshot = await this.llmConfigStore.deleteProfile(profileId)
    this.config = this.composeRuntimeConfig(this.configStore.getConfig(), nextSnapshot.resolvedConfig)
    await this.translationQueue.refreshConfiguration(this.config)

    if (this.translationQueue.getStatus().configured) {
      await this.enqueueHistoryTranslationsForEnabledChannels(this.characterRegistry.getSelectedCharacterId())
    }

    this.publishStatus()
    return this.getBootstrapData()
  }

  async fetchLlmProviderModels(input: FetchLlmProviderModelsInput) {
    const apiKey = input.apiKey?.trim() || (input.profileId ? await this.llmConfigStore.getApiKeyForProfile(input.profileId) : null)

    if (!apiKey) {
      throw new Error('API key is required before loading provider models.')
    }

    let apiBaseUrl = input.apiBaseUrl
    if (!apiBaseUrl && input.profileId) {
      const snapshot = this.llmConfigStore.getSnapshot()
      const storedProfile = snapshot.profiles.find((p) => p.profileId === input.profileId)
      apiBaseUrl = storedProfile?.apiBaseUrl
    }

    return fetchBuiltinProviderModels({
      ...input,
      apiKey,
      apiBaseUrl
    })
  }

  async getApiKeyForProfile(profileId: string): Promise<string | null> {
    return this.llmConfigStore.getApiKeyForProfile(profileId)
  }

  async addGlossaryEntry(entry: { notes?: string; terms: Record<string, string[]> }): Promise<BootstrapPayload> {
    const nextGlossary = [...this.config.glossary]
    const nextEntry: GlossaryEntry = {
      id: randomUUID(),
      notes: entry.notes?.trim() || undefined,
      terms: Object.fromEntries(
        Object.entries(entry.terms)
          .map(([lang, values]) => [lang, Array.isArray(values) ? values.filter((v) => v.trim().length > 0).map((v) => v.trim()) : []])
          .filter(([, values]) => (values as string[]).length > 0)
      )
    }
    nextGlossary.push(nextEntry)

    this.config = this.mergeAppConfig(await this.configStore.update({ glossary: nextGlossary }))
    return this.getBootstrapData()
  }

  async updateGlossaryEntry(entry: GlossaryEntry): Promise<BootstrapPayload> {
    const trimmedTerms = Object.fromEntries(
      Object.entries(entry.terms)
        .map(([lang, values]) => [lang, Array.isArray(values) ? values.filter((v) => v.trim().length > 0).map((v) => v.trim()) : []])
        .filter(([, values]) => (values as string[]).length > 0)
    )
    const nextGlossary = this.config.glossary.map((existing) =>
      existing.id === entry.id
        ? { ...entry, notes: entry.notes?.trim() || undefined, terms: trimmedTerms }
        : existing
    )

    this.config = this.mergeAppConfig(await this.configStore.update({ glossary: nextGlossary }))
    return this.getBootstrapData()
  }

  async deleteGlossaryEntry(id: string): Promise<BootstrapPayload> {
    const nextGlossary = this.config.glossary.filter((entry) => entry.id !== id)
    this.config = this.mergeAppConfig(await this.configStore.update({ glossary: nextGlossary }))
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
    await this.enqueueHistoryTranslationsForEnabledChannels(this.characterRegistry.getSelectedCharacterId())

    const senderNames = [...new Set(deduplicatedMessages.filter((m) => m.messageType === 'chat').map((m) => m.senderName))]
    void this.portraitService.resolvePortraits(senderNames, (portraits) => {
      this.publishPortraits(portraits)
    })
  }

  private async handleWatcherMessages(messages: ChatMessage[]): Promise<void> {
    const persistedMessages = await this.messageRepository.upsertMessages(messages)
    this.publishMessages(persistedMessages)
    await this.enqueueEligibleTranslations(persistedMessages)

    const senderNames = [...new Set(persistedMessages.filter((m) => m.messageType === 'chat').map((m) => m.senderName))]
    void this.portraitService.resolvePortraits(senderNames, (portraits) => {
      this.publishPortraits(portraits)
    })
  }

  private async hydrateSessionFromPath(filePath: string): Promise<ChatSessionFile | null> {
    const nextSession = await this.scanner.hydrateSessionFile(filePath)
    if (!nextSession) {
      return null
    }

    const currentSessions = this.scanIndex.sessionsByCharacter[nextSession.characterId] ?? []
    const nextSessions = [...currentSessions.filter((session) => session.absolutePath !== nextSession.absolutePath), nextSession]
    const characterLabels = Object.fromEntries(this.scanIndex.characters.map((character) => [character.characterId, character.label]))

    this.scanIndex = this.scanner.buildIndexFromSessions(
      {
        ...this.scanIndex.sessionsByCharacter,
        [nextSession.characterId]: nextSessions
      },
      characterLabels
    )

    this.characterRegistry.setCharacters(this.scanIndex.characters, this.config.selectedCharacterId)
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels, this.config.pinnedChannels)

    if (this.characterRegistry.getSelectedCharacterId() === nextSession.characterId) {
      this.publishChannels()
    }

    return this.scanIndex.sessionsByCharacter[nextSession.characterId]?.find((session) => session.absolutePath === filePath) ?? null
  }

  private isChannelEnabled(characterId: string, channelName: string): boolean {
    return (this.config.enabledChannels[characterId] ?? []).includes(channelName)
  }

  private composeRuntimeConfig(config: AppConfig, llmConfig: LlmResolvedConfig | null): AppConfig {
    return {
      ...config,
      activeProviderId: llmConfig?.providerId ?? null,
      apiBaseUrl: llmConfig?.apiBaseUrl ?? '',
      modelName: llmConfig?.modelName ?? ''
    }
  }

  private mergeAppConfig(config: AppConfig): AppConfig {
    return {
      ...config,
      activeProviderId: this.config.activeProviderId,
      apiBaseUrl: this.config.apiBaseUrl,
      modelName: this.config.modelName
    }
  }

  private extractNonLlmPatch(config: Partial<AppConfig>): Partial<AppConfig> {
    const { activeProviderId: _activeProviderId, apiBaseUrl: _apiBaseUrl, modelName: _modelName, ...rest } = config
    return rest
  }

  private buildLlmProviderState() {
    const snapshot = this.llmConfigStore.getSnapshot()

    return {
      providers: getBuiltinLlmProviders(),
      profiles: snapshot.profiles,
      activeProfileId: snapshot.activeProfileId
    }
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

  private async enqueueHistoryTranslationsForEnabledChannels(characterId: string | null): Promise<void> {
    if (!characterId || !this.translationQueue.getStatus().configured) {
      return
    }

    const enabledChannels = this.config.enabledChannels[characterId] ?? []

    for (const channelName of enabledChannels) {
      await this.enqueueChannelHistoryTranslations(characterId, channelName)
    }
  }

  private async enqueueChannelHistoryTranslations(characterId: string, channelName: string): Promise<void> {
    if (!this.translationQueue.getStatus().configured || !this.isChannelEnabled(characterId, channelName)) {
      return
    }

    const recentMessages = this.messageRepository.getChannelMessages(
      characterId,
      channelName,
      HISTORY_TRANSLATION_BACKFILL_LIMIT
    ).messages

    const untranslatedMessages = selectHistoryMessagesForTranslation(recentMessages, HISTORY_TRANSLATION_BACKFILL_LIMIT)

    await this.enqueueEligibleTranslations(untranslatedMessages)
  }

  private publishMessages(messages?: ChatMessage[]): void {
    if (!messages || messages.length === 0) {
      return
    }

    for (const window of this.getOpenWindows()) {
      emitMessages(window, messages)
    }
  }

  private publishChannels(): void {
    for (const window of this.getOpenWindows()) {
      emitChannels(window, this.channelRegistry.getChannels(this.characterRegistry.getSelectedCharacterId()))
    }
  }

  private publishStatus(): void {
    for (const window of this.getOpenWindows()) {
      emitStatus(window, {
        directoryStatus: this.pathResolver.resolveDirectory(this.config.logDirectory),
        watcherStatus: this.watcher.getStatus(),
        apiStatus: this.translationQueue.getStatus()
      })
    }
  }

  private publishPortraits(portraits: Record<string, string>): void {
    for (const window of this.getOpenWindows()) {
      emitPortraits(window, portraits)
    }
  }

  private registerPortraitProtocol(): void {
    const portraitsDirectory = this.portraitsDirectory
    protocol.handle('portrait', async (request) => {
      try {
        const fileName = basename(new URL(request.url).pathname)
        const filePath = join(portraitsDirectory, fileName)
        const data = await readFile(filePath)
        return new Response(data, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'max-age=604800'
          }
        })
      } catch {
        return new Response(null, { status: 404 })
      }
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
            click: () => {
              void this.openSettingsWindow()
            }
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

  focusPrimaryWindow(): void {
    const targetWindow = this.mainWindow ?? this.settingsWindow
    if (!targetWindow || targetWindow.isDestroyed()) {
      return
    }

    if (targetWindow.isMinimized()) {
      targetWindow.restore()
    }

    targetWindow.focus()
  }

  private getOpenWindows(): BrowserWindow[] {
    return [this.mainWindow, this.settingsWindow, this.overlayWindow].filter(
      (window): window is BrowserWindow => Boolean(window && !window.isDestroyed())
    )
  }

  private configureNativeWindow(window: BrowserWindow, kind: WindowKind): void {
    this.installNativeContextMenu(window)
    this.installWindowStatePersistence(window, kind)

    const savedState = this.windowStateStore.getWindowState(kind)
    if (savedState?.isMaximized) {
      window.maximize()
    }

    window.once('ready-to-show', () => {
      window.show()
      if (kind === 'settings') {
        window.focus()
      }
    })
  }

  private installNativeContextMenu(window: BrowserWindow): void {
    window.webContents.on('context-menu', (event, params) => {
      event.preventDefault()

      const template: MenuItemConstructorOptions[] = []

      if (params.isEditable) {
        template.push(
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        )
      } else if (params.selectionText.trim().length > 0) {
        template.push({ role: 'copy' }, { type: 'separator' }, { role: 'selectAll' })
      }

      if (template.length === 0) {
        return
      }

      Menu.buildFromTemplate(template).popup({ window })
    })
  }

  private installWindowStatePersistence(window: BrowserWindow, kind: WindowKind): void {
    let persistTimer: NodeJS.Timeout | null = null

    const persistNow = () => {
      if (persistTimer) {
        clearTimeout(persistTimer)
        persistTimer = null
      }

      void this.windowStateStore.updateWindowState(kind, this.captureWindowState(window))
    }

    const schedulePersist = () => {
      if (persistTimer) {
        clearTimeout(persistTimer)
      }

      persistTimer = setTimeout(() => {
        persistNow()
      }, 180)
    }

    window.on('move', schedulePersist)
    window.on('resize', schedulePersist)
    window.on('maximize', persistNow)
    window.on('unmaximize', persistNow)
    window.on('close', persistNow)
  }

  private captureWindowState(window: BrowserWindow): WindowStateSnapshot {
    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds()

    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized()
    }
  }

  private resolveWindowBounds(
    kind: WindowKind,
    defaults: { width: number; height: number; minWidth: number; minHeight: number }
  ): Partial<Electron.BrowserWindowConstructorOptions> {
    const savedState = this.windowStateStore.getWindowState(kind)
    if (!savedState) {
      return {
        width: defaults.width,
        height: defaults.height
      }
    }

    const width = Math.max(savedState.width, defaults.minWidth)
    const height = Math.max(savedState.height, defaults.minHeight)

    if (typeof savedState.x !== 'number' || typeof savedState.y !== 'number') {
      return { width, height }
    }

    const nextBounds = {
      x: savedState.x,
      y: savedState.y,
      width,
      height
    }

    if (!this.isVisibleOnAnyDisplay(nextBounds)) {
      return { width, height }
    }

    return nextBounds
  }

  private isVisibleOnAnyDisplay(bounds: { x: number; y: number; width: number; height: number }): boolean {
    return screen.getAllDisplays().some((display) => {
      const workArea = display.workArea
      return !(
        bounds.x + bounds.width <= workArea.x ||
        workArea.x + workArea.width <= bounds.x ||
        bounds.y + bounds.height <= workArea.y ||
        workArea.y + workArea.height <= bounds.y
      )
    })
  }

  private getWindowBackgroundColor(): string {
    return nativeTheme.shouldUseDarkColors ? '#0b1821' : '#ece4d7'
  }

  refreshNativeTheme(): void {
    for (const window of this.getOpenWindows()) {
      window.setBackgroundColor(this.getWindowBackgroundColor())
    }
  }

  private async loadRendererView(
    targetWindow: BrowserWindow,
    view: 'main' | 'settings' | 'overlay',
    channelName?: string
  ): Promise<void> {
    if (process.env.ELECTRON_RENDERER_URL) {
      let search = ''
      if (view === 'settings') {
        search = '?view=settings'
      } else if (view === 'overlay') {
        search = `?view=overlay&channel=${encodeURIComponent(channelName ?? '')}`
      }

      await targetWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}${search}`)
      return
    }

    let query: Record<string, string> | undefined
    if (view === 'settings') {
      query = { view: 'settings' }
    } else if (view === 'overlay') {
      query = { view: 'overlay', channel: channelName ?? '' }
    }

    await targetWindow.loadFile(join(app.getAppPath(), 'out', 'renderer', 'index.html'), { query })
  }
}

const eveBabelApp = new EveBabelApp()

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}

app.on('second-instance', () => {
  eveBabelApp.focusPrimaryWindow()
})

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'system'
    await eveBabelApp.initialize()
    registerIpcRouter({
      getBootstrapData: () => eveBabelApp.getBootstrapData(),
      getChannelMessages: (channelName, before, limit) => eveBabelApp.getChannelMessages(channelName, before, limit),
      cancelQueuedTranslations: () => eveBabelApp.cancelQueuedTranslations(),
      openLlmDebugFolder: () => eveBabelApp.openLlmDebugFolder(),
      refreshScan: () => eveBabelApp.refreshScan(),
      openSettingsWindow: () => eveBabelApp.openSettingsWindow(),
      setLogDirectory: (directory) => eveBabelApp.setLogDirectory(directory),
      selectCharacter: (characterId) => eveBabelApp.selectCharacter(characterId),
      setChannelEnabled: (channelName, enabled) => eveBabelApp.setChannelEnabled(channelName, enabled),
      setChannelPinned: (channelName, pinned) => eveBabelApp.setChannelPinned(channelName, pinned),
      updateSettings: (update) => eveBabelApp.updateSettings(update),
      saveLlmProviderProfile: (input) => eveBabelApp.saveLlmProviderProfile(input),
      deleteLlmProviderProfile: (profileId) => eveBabelApp.deleteLlmProviderProfile(profileId),
      setActiveLlmProviderProfile: (profileId) => eveBabelApp.setActiveLlmProviderProfile(profileId),
      fetchLlmProviderModels: (input) => eveBabelApp.fetchLlmProviderModels(input),
      getApiKeyForProfile: (profileId) => eveBabelApp.getApiKeyForProfile(profileId),
      addGlossaryEntry: (entry) => eveBabelApp.addGlossaryEntry(entry),
      updateGlossaryEntry: (entry) => eveBabelApp.updateGlossaryEntry(entry),
      deleteGlossaryEntry: (id) => eveBabelApp.deleteGlossaryEntry(id),
      openOverlayWindow: (channelName) => eveBabelApp.openOverlayWindow(channelName),
      closeOverlayWindow: () => eveBabelApp.closeOverlayWindow(),
      resizeOverlayBody: (deltaY) => eveBabelApp.resizeOverlayBody(deltaY)
    })
    nativeTheme.on('updated', () => {
      eveBabelApp.refreshNativeTheme()
    })
    await eveBabelApp.createWindow()

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await eveBabelApp.createWindow()
        return
      }

      eveBabelApp.focusPrimaryWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})