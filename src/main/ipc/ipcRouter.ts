import { dialog, ipcMain } from 'electron'

import type { AppSettingsUpdate, BootstrapPayload, ChatMessage, ChannelSummary } from '../../shared/types'

export interface IpcController {
  getBootstrapData: () => Promise<BootstrapPayload>
  refreshScan: () => Promise<BootstrapPayload>
  setLogDirectory: (directory: string) => Promise<BootstrapPayload>
  selectCharacter: (characterId: string) => Promise<BootstrapPayload>
  setChannelEnabled: (channelName: string, enabled: boolean) => Promise<BootstrapPayload>
  updateSettings: (update: AppSettingsUpdate) => Promise<BootstrapPayload>
}

export function registerIpcRouter(controller: IpcController): void {
  ipcMain.handle('app:getBootstrapData', () => controller.getBootstrapData())
  ipcMain.handle('app:refreshScan', () => controller.refreshScan())
  ipcMain.handle('app:setLogDirectory', (_event, directory: string) => controller.setLogDirectory(directory))
  ipcMain.handle('app:selectCharacter', (_event, characterId: string) => controller.selectCharacter(characterId))
  ipcMain.handle('app:setChannelEnabled', (_event, channelName: string, enabled: boolean) => {
    return controller.setChannelEnabled(channelName, enabled)
  })
  ipcMain.handle('app:updateSettings', (_event, update: AppSettingsUpdate) => controller.updateSettings(update))
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