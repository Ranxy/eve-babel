import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'

import type { LlmProviderId, LlmProviderProfile, SaveLlmProviderProfileInput } from '../../shared/types'
import { getLlmProviderDefinition } from './llmProviderCatalog'

const require = createRequire(import.meta.url)

export interface LlmResolvedConfig {
  providerId: LlmProviderId
  apiBaseUrl: string
  modelName: string
}

export interface LlmConfigSnapshot {
  profiles: LlmProviderProfile[]
  activeProfileId: string | null
  resolvedConfig: LlmResolvedConfig | null
}

type ProviderProfileRow = {
  profile_id: string
  provider_id: string
  api_base_url: string
  model_name: string
  encrypted_api_key: string | null
  is_active: number
  is_selected: number
  created_at: string
  updated_at: string
}

type LegacySqliteRow = {
  api_base_url: string
  model_name: string
  encrypted_api_key: string | null
}

interface LegacyCredentialPayload {
  encryptedApiKey: string | null
}

interface LegacyConfigPayload {
  apiBaseUrl?: string
  modelName?: string
}

interface SafeStorageLike {
  isEncryptionAvailable: () => boolean
  encryptString: (value: string) => Buffer
  decryptString: (value: Buffer) => string
}

export class LlmConfigStore {
  private sqlite: SqlJsStatic | null = null
  private database: Database | null = null

  constructor(
    private readonly filePath: string,
    private readonly legacyConfigPath?: string,
    private readonly legacyCredentialPath?: string
  ) {}

  async load(): Promise<LlmConfigSnapshot> {
    await mkdir(dirname(this.filePath), { recursive: true })

    if (!this.sqlite) {
      this.sqlite = await initSqlJs({
        locateFile: (fileName: string) => require.resolve(`sql.js/dist/${fileName}`)
      })
    }

    const fileExists = await stat(this.filePath)
      .then(() => true)
      .catch(() => false)

    if (fileExists) {
      const raw = await readFile(this.filePath)
      this.database = new this.sqlite.Database(new Uint8Array(raw))
    } else {
      this.database = new this.sqlite.Database()
    }

    this.initializeSchema()
    this.migrateIsSelectedColumnIfNeeded()
    await this.migrateLegacySqliteRowIfNeeded()
    await this.migrateLegacyFilesIfNeeded()
    await this.persist()
    return this.getSnapshot()
  }

  getSnapshot(): LlmConfigSnapshot {
    const rows = this.getProfileRows()
    const profiles = rows.map((row) => ({
      profileId: row.profile_id,
      providerId: row.provider_id as LlmProviderId,
      apiBaseUrl: row.api_base_url,
      modelName: row.model_name,
      hasApiKey: Boolean(row.encrypted_api_key),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active === 1
    }))
    const resolvedConfig = this.getActiveResolvedConfig()
    const selectedRow = rows.find((r) => r.is_selected === 1)

    return {
      profiles,
      activeProfileId: selectedRow?.profile_id ?? null,
      resolvedConfig
    }
  }

  getActiveResolvedConfig(): LlmResolvedConfig | null {
    const selectedProfile = this.getSelectedProfileRow()
    if (!selectedProfile) {
      return null
    }

    return {
      providerId: selectedProfile.provider_id as LlmProviderId,
      apiBaseUrl: selectedProfile.api_base_url,
      modelName: selectedProfile.model_name
    }
  }

  async getActiveApiKey(): Promise<string | null> {
    const selectedProfile = this.getSelectedProfileRow()
    if (!selectedProfile?.encrypted_api_key) {
      return null
    }

    return decryptStoredValue(selectedProfile.encrypted_api_key)
  }

  async getApiKeyForProfile(profileId: string): Promise<string | null> {
    const profile = this.getProfileRow(profileId)
    if (!profile?.encrypted_api_key) {
      return null
    }

    return decryptStoredValue(profile.encrypted_api_key)
  }

  async saveProfile(input: SaveLlmProviderProfileInput): Promise<LlmConfigSnapshot> {
    const database = this.getDatabase()
    const modelName = input.modelName.trim()

    if (!modelName) {
      throw new Error('Model name is required.')
    }

    const providerDefinition = getLlmProviderDefinition(input.providerId)
    const current = input.profileId ? this.getProfileRow(input.profileId) : null
    if (input.profileId && !current) {
      throw new Error(`Provider profile not found: ${input.profileId}`)
    }

    // Auto-select this profile if nothing is currently selected
    const selectedProfile = this.getSelectedProfileRow()
    const shouldAutoSelect = !selectedProfile

    const now = new Date().toISOString()
    const trimmedApiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : undefined

    let encryptedApiKey: string | null
    if (typeof trimmedApiKey !== 'undefined') {
      encryptedApiKey = trimmedApiKey ? await encryptValue(trimmedApiKey) : null
    } else if (current) {
      encryptedApiKey = current.encrypted_api_key ?? null
    } else if (input.copyApiKeyFromProfileId) {
      const sourceProfile = this.getProfileRow(input.copyApiKeyFromProfileId)
      encryptedApiKey = sourceProfile?.encrypted_api_key ?? null
    } else {
      encryptedApiKey = null
    }

    if (shouldAutoSelect) {
      database.run('UPDATE llm_provider_profiles SET is_selected = 0 WHERE is_selected != 0')
    }

    const profileId = current?.profile_id ?? randomUUID()
    const isSelected = shouldAutoSelect ? 1 : (current?.is_selected ?? 0)

    database.run(
      `
        INSERT INTO llm_provider_profiles (
          profile_id,
          provider_id,
          api_base_url,
          model_name,
          encrypted_api_key,
          is_active,
          is_selected,
          created_at,
          updated_at
        )
        VALUES (
          $profileId,
          $providerId,
          $apiBaseUrl,
          $modelName,
          $encryptedApiKey,
          1,
          $isSelected,
          $createdAt,
          $updatedAt
        )
        ON CONFLICT(profile_id) DO UPDATE SET
          provider_id = excluded.provider_id,
          api_base_url = excluded.api_base_url,
          model_name = excluded.model_name,
          encrypted_api_key = excluded.encrypted_api_key,
          is_active = 1,
          is_selected = excluded.is_selected,
          updated_at = excluded.updated_at
      `,
      {
        $profileId: profileId,
        $providerId: input.providerId,
        $apiBaseUrl: current?.api_base_url ?? providerDefinition.defaultApiBaseUrl,
        $modelName: modelName,
        $encryptedApiKey: encryptedApiKey,
        $isSelected: isSelected,
        $createdAt: current?.created_at ?? now,
        $updatedAt: now
      }
    )

    await this.persist()
    return this.getSnapshot()
  }

  async setActiveProfile(profileId: string): Promise<LlmConfigSnapshot> {
    const database = this.getDatabase()
    const current = this.getProfileRow(profileId)

    if (!current) {
      throw new Error(`Provider profile not found: ${profileId}`)
    }

    database.run('UPDATE llm_provider_profiles SET is_selected = 0 WHERE is_selected != 0')
    database.run(
      'UPDATE llm_provider_profiles SET is_selected = 1, updated_at = $updatedAt WHERE profile_id = $profileId',
      {
        $profileId: profileId,
        $updatedAt: new Date().toISOString()
      }
    )

    await this.persist()
    return this.getSnapshot()
  }

  async deleteProfile(profileId: string): Promise<LlmConfigSnapshot> {
    const database = this.getDatabase()
    const current = this.getProfileRow(profileId)

    if (!current) {
      return this.getSnapshot()
    }

    database.run('DELETE FROM llm_provider_profiles WHERE profile_id = $profileId', {
      $profileId: profileId
    })

    // If we deleted the selected profile, auto-select another (most recently updated)
    if (current.is_selected === 1) {
      database.run(
        `UPDATE llm_provider_profiles SET is_selected = 1, updated_at = $updatedAt
         WHERE profile_id = (
           SELECT profile_id FROM llm_provider_profiles
           WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1
         )`,
        { $updatedAt: new Date().toISOString() }
      )
    }

    await this.persist()
    return this.getSnapshot()
  }

  private initializeSchema(): void {
    const database = this.getDatabase()
    database.exec(`
      CREATE TABLE IF NOT EXISTS llm_provider_profiles (
        profile_id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        api_base_url TEXT NOT NULL,
        model_name TEXT NOT NULL,
        encrypted_api_key TEXT,
        is_active INTEGER NOT NULL DEFAULT 0,
        is_selected INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
  }

  private migrateIsSelectedColumnIfNeeded(): void {
    const database = this.getDatabase()
    try {
      database.exec('ALTER TABLE llm_provider_profiles ADD COLUMN is_selected INTEGER NOT NULL DEFAULT 0')
      // Column was just added — migrate: mark the previously-active profile as selected
      database.exec(`
        UPDATE llm_provider_profiles SET is_selected = 1
        WHERE profile_id = (
          SELECT profile_id FROM llm_provider_profiles
          WHERE is_active = 1
          ORDER BY updated_at DESC LIMIT 1
        )
      `)
    } catch {
      // Column already exists — nothing to do
    }
  }

  private getProfileRows(): ProviderProfileRow[] {
    const database = this.getDatabase()
    const statement = database.prepare(
      `
        SELECT profile_id, provider_id, api_base_url, model_name, encrypted_api_key, is_active, is_selected, created_at, updated_at
        FROM llm_provider_profiles
        ORDER BY is_selected DESC, is_active DESC, updated_at DESC, created_at DESC
      `
    )
    const rows: ProviderProfileRow[] = []

    while (statement.step()) {
      rows.push(statement.getAsObject() as ProviderProfileRow)
    }

    statement.free()
    return rows
  }

  private getProfileRow(profileId: string): ProviderProfileRow | null {
    const database = this.getDatabase()
    const statement = database.prepare(
      `
        SELECT profile_id, provider_id, api_base_url, model_name, encrypted_api_key, is_active, is_selected, created_at, updated_at
        FROM llm_provider_profiles
        WHERE profile_id = $profileId
      `
    )
    statement.bind({ $profileId: profileId })
    const row = statement.step() ? (statement.getAsObject() as ProviderProfileRow) : null
    statement.free()
    return row
  }

  private getSelectedProfileRow(): ProviderProfileRow | null {
    const database = this.getDatabase()
    const statement = database.prepare(
      `
        SELECT profile_id, provider_id, api_base_url, model_name, encrypted_api_key, is_active, is_selected, created_at, updated_at
        FROM llm_provider_profiles
        WHERE is_selected = 1
        ORDER BY updated_at DESC
        LIMIT 1
      `
    )
    const row = statement.step() ? (statement.getAsObject() as ProviderProfileRow) : null
    statement.free()
    return row
  }

  private hasProfiles(): boolean {
    return this.getProfileRows().length > 0
  }

  private getLegacySqliteRow(): LegacySqliteRow | null {
    const database = this.getDatabase()

    try {
      const statement = database.prepare(
        'SELECT api_base_url, model_name, encrypted_api_key FROM llm_settings WHERE id = 1 LIMIT 1'
      )
      const row = statement.step() ? (statement.getAsObject() as LegacySqliteRow) : null
      statement.free()
      return row
    } catch {
      return null
    }
  }

  private getDatabase(): Database {
    if (!this.database) {
      throw new Error('LlmConfigStore has not been loaded yet.')
    }

    return this.database
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, Buffer.from(this.getDatabase().export()))
  }

  private async migrateLegacySqliteRowIfNeeded(): Promise<void> {
    if (this.hasProfiles()) {
      return
    }

    const legacyRow = this.getLegacySqliteRow()
    if (!legacyRow) {
      return
    }

    const apiBaseUrl = legacyRow.api_base_url?.trim() ?? ''
    const modelName = legacyRow.model_name?.trim() ?? ''
    if (!apiBaseUrl && !modelName && !legacyRow.encrypted_api_key) {
      return
    }

    const database = this.getDatabase()
    const now = new Date().toISOString()
    database.run(
      `
        INSERT INTO llm_provider_profiles (
          profile_id,
          provider_id,
          api_base_url,
          model_name,
          encrypted_api_key,
          is_active,
          is_selected,
          created_at,
          updated_at
        )
        VALUES ($profileId, $providerId, $apiBaseUrl, $modelName, $encryptedApiKey, 1, 1, $createdAt, $updatedAt)
      `,
      {
        $profileId: randomUUID(),
        $providerId: 'openai',
        $apiBaseUrl: apiBaseUrl || getLlmProviderDefinition('openai').defaultApiBaseUrl,
        $modelName: modelName,
        $encryptedApiKey: legacyRow.encrypted_api_key,
        $createdAt: now,
        $updatedAt: now
      }
    )
  }

  private async migrateLegacyFilesIfNeeded(): Promise<void> {
    if (this.hasProfiles()) {
      return
    }

    const legacyConfig = await this.readLegacyConfig()
    const legacyApiKey = await this.readLegacyApiKey()

    if (!legacyConfig.apiBaseUrl && !legacyConfig.modelName && !legacyApiKey) {
      return
    }

    const now = new Date().toISOString()
    const database = this.getDatabase()
    database.run(
      `
        INSERT INTO llm_provider_profiles (
          profile_id,
          provider_id,
          api_base_url,
          model_name,
          encrypted_api_key,
          is_active,
          is_selected,
          created_at,
          updated_at
        )
        VALUES ($profileId, $providerId, $apiBaseUrl, $modelName, $encryptedApiKey, 1, 1, $createdAt, $updatedAt)
      `,
      {
        $profileId: randomUUID(),
        $providerId: 'openai',
        $apiBaseUrl: legacyConfig.apiBaseUrl || getLlmProviderDefinition('openai').defaultApiBaseUrl,
        $modelName: legacyConfig.modelName,
        $encryptedApiKey: legacyApiKey ? await encryptValue(legacyApiKey) : null,
        $createdAt: now,
        $updatedAt: now
      }
    )

    if (this.legacyCredentialPath) {
      const migratedFilePath = `${this.legacyCredentialPath}.migrated`
      await unlink(migratedFilePath).catch(() => undefined)
      await rename(this.legacyCredentialPath, migratedFilePath).catch(() => undefined)
    }
  }

  private async readLegacyConfig(): Promise<{ apiBaseUrl: string; modelName: string }> {
    if (!this.legacyConfigPath) {
      return { apiBaseUrl: '', modelName: '' }
    }

    try {
      const raw = await readFile(this.legacyConfigPath, 'utf8')
      const payload = JSON.parse(raw) as LegacyConfigPayload
      return {
        apiBaseUrl: typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl.trim() : '',
        modelName: typeof payload.modelName === 'string' ? payload.modelName.trim() : ''
      }
    } catch {
      return { apiBaseUrl: '', modelName: '' }
    }
  }

  private async readLegacyApiKey(): Promise<string | null> {
    if (!this.legacyCredentialPath) {
      return null
    }

    try {
      const raw = await readFile(this.legacyCredentialPath, 'utf8')
      const payload = JSON.parse(raw) as LegacyCredentialPayload
      return payload.encryptedApiKey ? decryptStoredValue(payload.encryptedApiKey) : null
    } catch {
      return null
    }
  }

  static createDefaultFilePath(userDataDirectory: string): string {
    return join(userDataDirectory, 'llm-config.sqlite')
  }
}

async function getSafeStorage() {
  if (!process.versions.electron) {
    return null
  }

  const electronModule = await import('electron').catch(() => null)
  if (!electronModule || typeof electronModule !== 'object') {
    return null
  }

  const safeStorage = 'safeStorage' in electronModule ? (electronModule.safeStorage as SafeStorageLike | null) : null

  if (
    safeStorage &&
    typeof safeStorage.isEncryptionAvailable === 'function' &&
    typeof safeStorage.encryptString === 'function' &&
    typeof safeStorage.decryptString === 'function'
  ) {
    return safeStorage
  }

  return null
}

async function encryptValue(value: string): Promise<string> {
  const safeStorage = await getSafeStorage()
  if (safeStorage?.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }

  return Buffer.from(value, 'utf8').toString('base64')
}

async function decryptStoredValue(value: string): Promise<string> {
  const rawBuffer = Buffer.from(value, 'base64')
  const safeStorage = await getSafeStorage()

  if (safeStorage?.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(rawBuffer)
    } catch {
      return rawBuffer.toString('utf8')
    }
  }

  return rawBuffer.toString('utf8')
}