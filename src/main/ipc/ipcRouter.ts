import { dialog, ipcMain } from 'electron'

import type {
  AppSettingsUpdate,
  BootstrapPayload,
  ChannelMessagePage,
  ChatMessage,
  ChannelSummary,
  FetchLlmProviderModelsInput,
  LlmProviderModel,
  MessagePageCursor,
  SaveLlmProviderProfileInput
} from '../../shared/types'

export interface IpcController {
  getBootstrapData: () => Promise<BootstrapPayload>
  getChannelMessages: (channelName: string, before?: MessagePageCursor | null, limit?: number) => Promise<ChannelMessagePage>
  cancelQueuedTranslations: () => Promise<BootstrapPayload>
  openLlmDebugFolder: () => Promise<void>
  refreshScan: () => Promise<BootstrapPayload>
  openSettingsWindow: () => Promise<void>
  setLogDirectory: (directory: string) => Promise<BootstrapPayload>
  selectCharacter: (characterId: string) => Promise<BootstrapPayload>
  setChannelEnabled: (channelName: string, enabled: boolean) => Promise<BootstrapPayload>
  setChannelPinned: (channelName: string, pinned: boolean) => Promise<BootstrapPayload>
  updateSettings: (update: AppSettingsUpdate) => Promise<BootstrapPayload>
  saveLlmProviderProfile: (input: SaveLlmProviderProfileInput) => Promise<BootstrapPayload>
  deleteLlmProviderProfile: (profileId: string) => Promise<BootstrapPayload>
  setActiveLlmProviderProfile: (profileId: string) => Promise<BootstrapPayload>
  fetchLlmProviderModels: (input: FetchLlmProviderModelsInput) => Promise<LlmProviderModel[]>
  getApiKeyForProfile: (profileId: string) => Promise<string | null>
}

export function registerIpcRouter(controller: IpcController): void {
  ipcMain.handle('app:getBootstrapData', () => controller.getBootstrapData())
  ipcMain.handle('app:getChannelMessages', (_event, channelName: string, before?: MessagePageCursor | null, limit?: number) => {
    return controller.getChannelMessages(channelName, before, limit)
  })
  ipcMain.handle('app:cancelQueuedTranslations', () => controller.cancelQueuedTranslations())
  ipcMain.handle('app:openLlmDebugFolder', () => controller.openLlmDebugFolder())
  ipcMain.handle('app:refreshScan', () => controller.refreshScan())
  ipcMain.handle('app:openSettingsWindow', () => controller.openSettingsWindow())
  ipcMain.handle('app:setLogDirectory', (_event, directory: string) => controller.setLogDirectory(directory))
  ipcMain.handle('app:selectCharacter', (_event, characterId: string) => controller.selectCharacter(characterId))
  ipcMain.handle('app:setChannelEnabled', (_event, channelName: string, enabled: boolean) => {
    return controller.setChannelEnabled(channelName, enabled)
  })
  ipcMain.handle('app:setChannelPinned', (_event, channelName: string, pinned: boolean) => {
    return controller.setChannelPinned(channelName, pinned)
  })
  ipcMain.handle('app:updateSettings', (_event, update: AppSettingsUpdate) => controller.updateSettings(update))
  ipcMain.handle('app:saveLlmProviderProfile', (_event, input: SaveLlmProviderProfileInput) => {
    return controller.saveLlmProviderProfile(input)
  })
  ipcMain.handle('app:deleteLlmProviderProfile', (_event, profileId: string) => {
    return controller.deleteLlmProviderProfile(profileId)
  })
  ipcMain.handle('app:setActiveLlmProviderProfile', (_event, profileId: string) => {
    return controller.setActiveLlmProviderProfile(profileId)
  })
  ipcMain.handle('app:fetchLlmProviderModels', (_event, input: FetchLlmProviderModelsInput) => {
    return controller.fetchLlmProviderModels(input)
  })
  ipcMain.handle('app:getApiKeyForProfile', (_event, profileId: string) => {
    return controller.getApiKeyForProfile(profileId)
  })
  ipcMain.handle('app:chooseLogDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return controller.getBootstrapData()
    }

    return controller.setLogDirectory(result.filePaths[0])
  })
}

export function emitMessages(window: Electron.BrowserWindow, messages: ChatMessage[]): void {
  window.webContents.send('messages:upsert', messages)
}

export function emitChannels(window: Electron.BrowserWindow, channels: ChannelSummary[]): void {
  window.webContents.send('channels:update', channels)
}

export function emitStatus(window: Electron.BrowserWindow, payload: Pick<BootstrapPayload, 'directoryStatus' | 'watcherStatus' | 'apiStatus'>): void {
  window.webContents.send('status:update', payload)
}

export function emitPortraits(window: Electron.BrowserWindow, portraits: Record<string, string>): void {
  window.webContents.send('portraits:update', portraits)
}