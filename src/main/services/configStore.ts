import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { DEFAULT_TARGET_LANGUAGE, DEFAULT_TRANSLATION_PROMPT, isTargetLanguage, type AppConfig } from '../../shared/types'

const DEFAULT_CONFIG: AppConfig = {
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
  maxQueueSize: 100
}

function sanitizeConfig(input: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    logDirectory: typeof input.logDirectory === 'string' || input.logDirectory === null ? input.logDirectory : null,
    selectedCharacterId:
      typeof input.selectedCharacterId === 'string' || input.selectedCharacterId === null ? input.selectedCharacterId : null,
    enabledChannels: sanitizeChannelMap(input.enabledChannels),
    pinnedChannels: sanitizeChannelMap(input.pinnedChannels),
    llmDebugEnabled: typeof input.llmDebugEnabled === 'boolean' ? input.llmDebugEnabled : DEFAULT_CONFIG.llmDebugEnabled,
    targetLanguage: typeof input.targetLanguage === 'string' && isTargetLanguage(input.targetLanguage) ? input.targetLanguage : DEFAULT_CONFIG.targetLanguage,
    translationPrompt:
      typeof input.translationPrompt === 'string' && input.translationPrompt.trim().length > 0
        ? input.translationPrompt.trim()
        : DEFAULT_CONFIG.translationPrompt,
    debounceMs: typeof input.debounceMs === 'number' ? input.debounceMs : DEFAULT_CONFIG.debounceMs,
    maxQueueSize: typeof input.maxQueueSize === 'number' ? input.maxQueueSize : DEFAULT_CONFIG.maxQueueSize
  }
}

function sanitizeChannelMap(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(input).map(([characterId, channels]) => [
      characterId,
      Array.isArray(channels)
        ? Array.from(new Set(channels.filter((channel): channel is string => typeof channel === 'string'))).sort((left, right) =>
            left.localeCompare(right)
          )
        : []
    ])
  )
}

export class ConfigStore {
  private config = { ...DEFAULT_CONFIG }

  constructor(private readonly filePath: string) {}

  async load(): Promise<AppConfig> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      this.config = sanitizeConfig(JSON.parse(raw) as Partial<AppConfig>)
    } catch {
      this.config = { ...DEFAULT_CONFIG }
    }

    return this.getConfig()
  }

  getConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)) as AppConfig
  }

  async update(patch: Partial<AppConfig>): Promise<AppConfig> {
    this.config = sanitizeConfig({
      ...this.config,
      ...patch,
      enabledChannels: patch.enabledChannels ? { ...patch.enabledChannels } : { ...this.config.enabledChannels },
      pinnedChannels: patch.pinnedChannels ? { ...patch.pinnedChannels } : { ...this.config.pinnedChannels }
    })
    await this.persist()
    return this.getConfig()
  }

  async setChannelEnabled(characterId: string, channelName: string, enabled: boolean): Promise<AppConfig> {
    const currentChannels = new Set(this.config.enabledChannels[characterId] ?? [])

    if (enabled) {
      currentChannels.add(channelName)
    } else {
      currentChannels.delete(channelName)
    }

    this.config.enabledChannels = {
      ...this.config.enabledChannels,
      [characterId]: Array.from(currentChannels).sort((left, right) => left.localeCompare(right))
    }

    await this.persist()
    return this.getConfig()
  }

  async setChannelPinned(characterId: string, channelName: string, pinned: boolean): Promise<AppConfig> {
    const currentChannels = new Set(this.config.pinnedChannels[characterId] ?? [])

    if (pinned) {
      currentChannels.add(channelName)
    } else {
      currentChannels.delete(channelName)
    }

    this.config.pinnedChannels = {
      ...this.config.pinnedChannels,
      [characterId]: Array.from(currentChannels).sort((left, right) => left.localeCompare(right))
    }

    await this.persist()
    return this.getConfig()
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.config, null, 2), 'utf8')
  }

  static createDefaultFilePath(userDataDirectory: string): string {
    return join(userDataDirectory, 'config.json')
  }
}