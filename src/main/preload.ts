import { contextBridge, ipcRenderer } from 'electron'

import type { AppSettingsUpdate, ChatMessage, ChannelSummary, EveBabelApi } from '../shared/types'

const api: EveBabelApi = {
  getBootstrapData: () => ipcRenderer.invoke('app:getBootstrapData'),
  refreshScan: () => ipcRenderer.invoke('app:refreshScan'),
  chooseLogDirectory: () => ipcRenderer.invoke('app:chooseLogDirectory'),
  openSettingsWindow: () => ipcRenderer.invoke('app:openSettingsWindow'),
  setLogDirectory: (directory: string) => ipcRenderer.invoke('app:setLogDirectory', directory),
  selectCharacter: (characterId: string) => ipcRenderer.invoke('app:selectCharacter', characterId),
  setChannelEnabled: (channelName: string, enabled: boolean) => {
    return ipcRenderer.invoke('app:setChannelEnabled', channelName, enabled)
  },
  updateSettings: (update: AppSettingsUpdate) => ipcRenderer.invoke('app:updateSettings', update),
  onMessagesUpsert: (listener: (messages: ChatMessage[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, messages: ChatMessage[]) => listener(messages)
    ipcRenderer.on('messages:upsert', subscription)
    return () => ipcRenderer.removeListener('messages:upsert', subscription)
  },
  onChannelsUpdate: (listener: (channels: ChannelSummary[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, channels: ChannelSummary[]) => listener(channels)
    ipcRenderer.on('channels:update', subscription)
    return () => ipcRenderer.removeListener('channels:update', subscription)
  },
  onStatusUpdate: (listener) => {
    const subscription = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => listener(payload)
    ipcRenderer.on('status:update', subscription)
    return () => ipcRenderer.removeListener('status:update', subscription)
  }
}

contextBridge.exposeInMainWorld('eveBabel', api)