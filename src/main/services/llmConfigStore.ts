import { createRequire } from 'node:module'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'

const require = createRequire(import.meta.url)

export interface LlmConfigRecord {
  apiBaseUrl: string
  modelName: string
}

interface LlmConfigUpdate extends Partial<LlmConfigRecord> {
  apiKey?: string | null
}

type LlmSettingsRow = {
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

export class LlmConfigStore {
  private sqlite: SqlJsStatic | null = null
  private database: Database | null = null

  constructor(
    private readonly filePath: string,
    private readonly legacyConfigPath?: string,
    private readonly legacyCredentialPath?: string
  ) {}

  async load(): Promise<LlmConfigRecord> {
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
    await this.ensureSeedRow()
    await this.migrateLegacyFilesIfNeeded()
    await this.persist()
    return this.getConfig()
  }

  getConfig(): LlmConfigRecord {
    const row = this.getRow()
    return {
      apiBaseUrl: row?.api_base_url ?? '',
      modelName: row?.model_name ?? ''
    }
  }

  async getApiKey(): Promise<string | null> {
    const row = this.getRow()
    if (!row?.encrypted_api_key) {
      return null
    }

    return decryptStoredValue(row.encrypted_api_key)
  }

  async update(update: LlmConfigUpdate): Promise<LlmConfigRecord> {
    const database = this.getDatabase()
    const current = this.getRow()
    const currentApiKey = current?.encrypted_api_key ?? null

    const nextApiKey =
      typeof update.apiKey === 'undefined' ? currentApiKey : update.apiKey ? await encryptValue(update.apiKey.trim()) : null

    database.run(
      `
        INSERT INTO llm_settings (id, api_base_url, model_name, encrypted_api_key, updated_at)
        VALUES (1, $apiBaseUrl, $modelName, $encryptedApiKey, $updatedAt)
        ON CONFLICT(id) DO UPDATE SET
          api_base_url = excluded.api_base_url,
          model_name = excluded.model_name,
          encrypted_api_key = excluded.encrypted_api_key,
          updated_at = excluded.updated_at
      `,
      {
        $apiBaseUrl: typeof update.apiBaseUrl === 'string' ? update.apiBaseUrl.trim() : current?.api_base_url ?? '',
        $modelName: typeof update.modelName === 'string' ? update.modelName.trim() : current?.model_name ?? '',
        $encryptedApiKey: nextApiKey,
        $updatedAt: new Date().toISOString()
      }
    )

    await this.persist()
    return this.getConfig()
  }

  private initializeSchema(): void {
    const database = this.getDatabase()
    database.exec(`
      CREATE TABLE IF NOT EXISTS llm_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_base_url TEXT NOT NULL,
        model_name TEXT NOT NULL,
        encrypted_api_key TEXT,
        updated_at TEXT NOT NULL
      );
    `)
  }

  private async ensureSeedRow(): Promise<void> {
    const database = this.getDatabase()
    database.run(
      `
        INSERT INTO llm_settings (id, api_base_url, model_name, encrypted_api_key, updated_at)
        VALUES (1, '', '', NULL, $updatedAt)
        ON CONFLICT(id) DO NOTHING
      `,
      {
        $updatedAt: new Date().toISOString()
      }
    )
  }

  private getRow(): LlmSettingsRow | null {
    const database = this.getDatabase()
    const statement = database.prepare('SELECT api_base_url, model_name, encrypted_api_key FROM llm_settings WHERE id = 1')
    const row = statement.step() ? (statement.getAsObject() as LlmSettingsRow) : null
    statement.free()
    return row
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

  private async migrateLegacyFilesIfNeeded(): Promise<void> {
    const current = this.getRow()
    const alreadyConfigured = Boolean(current && (current.api_base_url || current.model_name || current.encrypted_api_key))

    if (alreadyConfigured) {
      return
    }

    const legacyConfig = await this.readLegacyConfig()
    const legacyApiKey = await this.readLegacyApiKey()

    if (!legacyConfig.apiBaseUrl && !legacyConfig.modelName && !legacyApiKey) {
      return
    }

    await this.update({
      apiBaseUrl: legacyConfig.apiBaseUrl ?? '',
      modelName: legacyConfig.modelName ?? '',
      apiKey: legacyApiKey
    })

    if (this.legacyCredentialPath) {
      const migratedFilePath = `${this.legacyCredentialPath}.migrated`
      await unlink(migratedFilePath).catch(() => undefined)
      await rename(this.legacyCredentialPath, migratedFilePath).catch(() => undefined)
    }
  }

  private async readLegacyConfig(): Promise<LlmConfigRecord> {
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

  const safeStorage = 'safeStorage' in electronModule ? electronModule.safeStorage : null

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