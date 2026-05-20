export type MessageType = 'chat' | 'system'
export type TranslationStatus = 'idle' | 'queued' | 'translating' | 'translated' | 'error' | 'skipped'
export type WatcherState = 'idle' | 'watching' | 'error'

export interface CharacterSummary {
  characterId: string
  label: string
  recentActivityAt: string | null
  availableChannelCount: number
  logFileCount: number
}

export interface ChannelSummary {
  channelName: string
  enabled: boolean
  messageCount: number
  latestSessionStarted: string | null
  sourceCharacterId: string
}

export interface ChatSessionFile {
  absolutePath: string
  channelName: string
  characterId: string
  sessionStarted: string
  lastReadOffset: number
  isActive: boolean
  listenerName: string | null
}

export interface ChatMessage {
  messageId: string
  timestamp: string
  channelName: string
  characterId: string
  senderName: string
  messageText: string
  messageType: MessageType
  sessionFilePath: string
  translationStatus: TranslationStatus
  translatedText: string | null
  errorMessage: string | null
}

export interface TranslationJob {
  jobId: string
  messageId: string
  targetLanguage: string
  provider: string
  model: string
  retryCount: number
  queuedAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface AppConfig {
  logDirectory: string | null
  selectedCharacterId: string | null
  enabledChannels: Record<string, string[]>
  targetLanguage: string
  apiBaseUrl: string
  modelName: string
  debounceMs: number
  maxQueueSize: number
}

export interface DirectoryStatus {
  path: string | null
  exists: boolean
  source: 'default' | 'manual' | 'missing'
  errorMessage: string | null
}

export interface WatcherStatus {
  state: WatcherState
  watchedChannels: number
  activeFiles: number
  lastEventAt: string | null
  lastError: string | null
}

export interface ApiStatus {
  configured: boolean
  queueLength: number
  activeJobs: number
  lastSuccessAt: string | null
  lastError: string | null
}

export interface BootstrapPayload {
  directoryStatus: DirectoryStatus
  config: AppConfig
  characters: CharacterSummary[]
  channels: ChannelSummary[]
  recentMessages: ChatMessage[]
  watcherStatus: WatcherStatus
  apiStatus: ApiStatus
}

export interface AppSettingsUpdate {
  config: Partial<AppConfig>
  apiKey?: string
}

export interface RendererEvents {
  'messages:upsert': ChatMessage[]
  'channels:update': ChannelSummary[]
  'status:update': Pick<BootstrapPayload, 'directoryStatus' | 'watcherStatus' | 'apiStatus'>
}

export interface EveBabelApi {
  getBootstrapData: () => Promise<BootstrapPayload>
  refreshScan: () => Promise<BootstrapPayload>
  chooseLogDirectory: () => Promise<BootstrapPayload>
  setLogDirectory: (directory: string) => Promise<BootstrapPayload>
  selectCharacter: (characterId: string) => Promise<BootstrapPayload>
  setChannelEnabled: (channelName: string, enabled: boolean) => Promise<BootstrapPayload>
  updateSettings: (update: AppSettingsUpdate) => Promise<BootstrapPayload>
  onMessagesUpsert: (listener: (messages: ChatMessage[]) => void) => () => void
  onChannelsUpdate: (listener: (channels: ChannelSummary[]) => void) => () => void
  onOpenSettings: (listener: () => void) => () => void
  onStatusUpdate: (
    listener: (payload: Pick<BootstrapPayload, 'directoryStatus' | 'watcherStatus' | 'apiStatus'>) => void
  ) => () => void
}

export interface ParsedChunkResult {
  messages: ChatMessage[]
  leftoverText: string
}

export interface HeaderMetadata {
  channelId: string | null
  channelName: string | null
  listenerName: string | null
  sessionStarted: string | null
}