import { app, BrowserWindow, Menu, nativeTheme, screen, type MenuItemConstructorOptions } from 'electron'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
import { WindowStateStore, type WindowKind, type WindowStateSnapshot } from './services/windowStateStore'

const currentDirectory = dirname(fileURLToPath(import.meta.url))

class EveBabelApp {
  private mainWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null
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
    pinnedChannels: {},
    targetLanguage: 'zh-CN',
    apiBaseUrl: '',
    modelName: '',
    debounceMs: 350,
    maxQueueSize: 100
  }

  async initialize(): Promise<void> {
    const persistedConfig = await this.configStore.load()
    const llmConfig = await this.llmConfigStore.load()
    await this.windowStateStore.load()
    this.config = this.composeRuntimeConfig(persistedConfig, llmConfig)
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
    const nextLlmConfig = await this.llmConfigStore.update({
      apiBaseUrl: update.config.apiBaseUrl,
      modelName: update.config.modelName,
      apiKey: update.apiKey
    })

    this.config = this.composeRuntimeConfig(nextAppConfig, nextLlmConfig)
    this.channelRegistry.setChannels(this.scanIndex.channelsByCharacter, this.config.enabledChannels, this.config.pinnedChannels)
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
    return [this.mainWindow, this.settingsWindow].filter((window): window is BrowserWindow => Boolean(window && !window.isDestroyed()))
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

  private async loadRendererView(targetWindow: BrowserWindow, view: 'main' | 'settings'): Promise<void> {
    const search = view === 'settings' ? '?view=settings' : ''

    if (process.env.ELECTRON_RENDERER_URL) {
      await targetWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}${search}`)
      return
    }

    const rendererUrl = `${pathToFileURL(join(currentDirectory, '../renderer/index.html')).toString()}${search}`
    await targetWindow.loadURL(rendererUrl)
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
      refreshScan: () => eveBabelApp.refreshScan(),
      openSettingsWindow: () => eveBabelApp.openSettingsWindow(),
      setLogDirectory: (directory) => eveBabelApp.setLogDirectory(directory),
      selectCharacter: (characterId) => eveBabelApp.selectCharacter(characterId),
      setChannelEnabled: (channelName, enabled) => eveBabelApp.setChannelEnabled(channelName, enabled),
      setChannelPinned: (channelName, pinned) => eveBabelApp.setChannelPinned(channelName, pinned),
      updateSettings: (update) => eveBabelApp.updateSettings(update)
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