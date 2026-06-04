import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { DEFAULT_TARGET_LANGUAGE, DEFAULT_TRANSLATION_PROMPT, isTargetLanguage, type AppConfig, type GlossaryEntry } from '../../shared/types'

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
  maxQueueSize: 100,
  glossary: [],
  autoGlossaryEnabled: true,
  autoGlossaryMaxTerms: 30
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
    maxQueueSize: typeof input.maxQueueSize === 'number' ? input.maxQueueSize : DEFAULT_CONFIG.maxQueueSize,
    glossary: sanitizeGlossary(input.glossary),
    autoGlossaryEnabled: typeof input.autoGlossaryEnabled === 'boolean' ? input.autoGlossaryEnabled : DEFAULT_CONFIG.autoGlossaryEnabled,
    autoGlossaryMaxTerms:
      typeof input.autoGlossaryMaxTerms === 'number'
        ? Math.max(5, Math.min(80, input.autoGlossaryMaxTerms))
        : DEFAULT_CONFIG.autoGlossaryMaxTerms
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

function sanitizeGlossary(input: unknown): GlossaryEntry[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .filter(
      (entry): entry is GlossaryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as GlossaryEntry).id === 'string' &&
        (entry as GlossaryEntry).id.trim().length > 0 &&
        typeof (entry as GlossaryEntry).terms === 'object' &&
        (entry as GlossaryEntry).terms !== null
    )
    .map((entry) => ({
      id: entry.id.trim(),
      notes: typeof entry.notes === 'string' ? entry.notes.trim() || undefined : undefined,
      terms: sanitizeTermsMap(entry.terms)
    }))
    .filter((entry) => Object.keys(entry.terms).length > 0)
}

function sanitizeTermsMap(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(input)
      .filter((entry): entry is [string, unknown] => typeof entry[0] === 'string' && entry[0].trim().length > 0)
      .map(([lang, values]) => {
        const variants = sanitizeTermVariants(values)
        return [lang, variants] as [string, string[]]
      })
      .filter(([, variants]) => variants.length > 0)
  )
}

function sanitizeTermVariants(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
  }

  if (typeof input === 'string' && input.trim().length > 0) {
    return [input.trim()]
  }

  return []
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