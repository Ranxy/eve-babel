export type MessageType = 'chat' | 'system'
export type TranslationStatus = 'idle' | 'queued' | 'translating' | 'translated' | 'error' | 'skipped'
export type WatcherState = 'idle' | 'watching' | 'error'

export const TARGET_LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'zh-TW', label: 'Chinese (Traditional)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'de-DE', label: 'German' },
  { value: 'fr-FR', label: 'French' },
  { value: 'ru-RU', label: 'Russian' }
] as const

export type TargetLanguage = (typeof TARGET_LANGUAGE_OPTIONS)[number]['value']

export const DEFAULT_TARGET_LANGUAGE: TargetLanguage = 'zh-CN'
export const DEFAULT_TRANSLATION_PROMPT =
  'Translate incoming EVE Online chat messages into {{targetLanguage}}. Preserve EVE-specific terms where appropriate. Return translation only.'

export const SUPPORTED_LLM_PROVIDER_IDS = ['openai', 'deepseek', 'openrouter', 'custom'] as const

export type LlmProviderId = (typeof SUPPORTED_LLM_PROVIDER_IDS)[number]

export function isLlmProviderId(value: string): value is LlmProviderId {
  return SUPPORTED_LLM_PROVIDER_IDS.includes(value as LlmProviderId)
}

export function isTargetLanguage(value: string): value is TargetLanguage {
  return TARGET_LANGUAGE_OPTIONS.some((option) => option.value === value)
}

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
  pinned: boolean
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

export interface MessagePageCursor {
  timestamp: string
  messageId: string
}

export interface ChannelMessagePage {
  characterId: string
  channelName: string
  messages: ChatMessage[]
  hasMore: boolean
}

export interface TranslationJob {
  jobId: string
  messageId: string
  characterId: string
  channelName: string
  senderName: string
  messageText: string
  timestamp: string
  targetLanguage: string
  provider: string
  model: string
  retryCount: number
  queuedAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface LlmProviderDefinition {
  providerId: LlmProviderId
  label: string
  description: string
  defaultApiBaseUrl: string
}

export interface LlmProviderModel {
  modelId: string
  label: string
  ownedBy: string | null
}

export interface LlmProviderProfile {
  profileId: string
  providerId: LlmProviderId
  apiBaseUrl: string
  modelName: string
  customLabel: string | null
  hasApiKey: boolean
  createdAt: string
  updatedAt: string
  isActive: boolean
}

export interface LlmProviderState {
  providers: LlmProviderDefinition[]
  profiles: LlmProviderProfile[]
  activeProfileId: string | null
}

export interface AppConfig {
  logDirectory: string | null
  selectedCharacterId: string | null
  enabledChannels: Record<string, string[]>
  pinnedChannels: Record<string, string[]>
  llmDebugEnabled: boolean
  targetLanguage: TargetLanguage
  translationPrompt: string
  activeProviderId: LlmProviderId | null
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
  llmProviderState: LlmProviderState
  characters: CharacterSummary[]
  channels: ChannelSummary[]
  recentMessages: ChatMessage[]
  watcherStatus: WatcherStatus
  apiStatus: ApiStatus
  portraits: Record<string, string>
}

export interface AppSettingsUpdate {
  config: Partial<AppConfig>
}

export interface SaveLlmProviderProfileInput {
  profileId?: string
  providerId: LlmProviderId
  modelName: string
  apiKey?: string
  copyApiKeyFromProfileId?: string
  customLabel?: string
  apiBaseUrl?: string
}

export interface FetchLlmProviderModelsInput {
  providerId: LlmProviderId
  profileId?: string
  apiKey?: string
  apiBaseUrl?: string
}

export interface RendererEvents {
  'messages:upsert': ChatMessage[]
  'channels:update': ChannelSummary[]
  'status:update': Pick<BootstrapPayload, 'directoryStatus' | 'watcherStatus' | 'apiStatus'>
  'portraits:update': Record<string, string>
}

export interface EveBabelApi {
  getBootstrapData: () => Promise<BootstrapPayload>
  getChannelMessages: (channelName: string, before?: MessagePageCursor | null, limit?: number) => Promise<ChannelMessagePage>
  cancelQueuedTranslations: () => Promise<BootstrapPayload>
  openLlmDebugFolder: () => Promise<void>
  refreshScan: () => Promise<BootstrapPayload>
  chooseLogDirectory: () => Promise<BootstrapPayload>
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
  onMessagesUpsert: (listener: (messages: ChatMessage[]) => void) => () => void
  onChannelsUpdate: (listener: (channels: ChannelSummary[]) => void) => () => void
  onStatusUpdate: (
    listener: (payload: Pick<BootstrapPayload, 'directoryStatus' | 'watcherStatus' | 'apiStatus'>) => void
  ) => () => void
  onPortraitsUpdate: (listener: (portraits: Record<string, string>) => void) => () => void
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