import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { safeStorage } from 'electron'

interface CredentialPayload {
  encryptedApiKey: string | null
}

export class CredentialStore {
  constructor(private readonly filePath: string) {}

  async getApiKey(): Promise<string | null> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const payload = JSON.parse(raw) as CredentialPayload

      if (!payload.encryptedApiKey) {
        return null
      }

      if (!safeStorage.isEncryptionAvailable()) {
        return Buffer.from(payload.encryptedApiKey, 'base64').toString('utf8')
      }

      return safeStorage.decryptString(Buffer.from(payload.encryptedApiKey, 'base64'))
    } catch {
      return null
    }
  }

  async setApiKey(apiKey: string | null): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })

    const encryptedApiKey = apiKey
      ? safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(apiKey).toString('base64')
        : Buffer.from(apiKey, 'utf8').toString('base64')
      : null

    const payload: CredentialPayload = { encryptedApiKey }
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  static createDefaultFilePath(userDataDirectory: string): string {
    return join(userDataDirectory, 'credentials.json')
  }
}