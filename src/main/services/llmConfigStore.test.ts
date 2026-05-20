import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { LlmConfigStore } from './llmConfigStore'

const tempDirectories: string[] = []

async function createTempDirectory(prefix: string) {
  const directoryPath = await mkdtemp(join(tmpdir(), prefix))
  tempDirectories.push(directoryPath)
  return directoryPath
}

afterEach(async () => {
  while (tempDirectories.length > 0) {
    const directoryPath = tempDirectories.pop()
    if (directoryPath) {
      await rm(directoryPath, { recursive: true, force: true })
    }
  }
})

describe('LlmConfigStore', () => {
  it('stores a single base URL, model name, and API key in SQLite', async () => {
    const directoryPath = await createTempDirectory('eve-babel-llm-config-')
    const store = new LlmConfigStore(join(directoryPath, 'llm-config.sqlite'))

    await store.load()
    const nextConfig = await store.update({
      apiBaseUrl: 'https://example.com/v1',
      modelName: 'custom-model',
      apiKey: 'secret-token'
    })

    expect(nextConfig).toEqual({
      apiBaseUrl: 'https://example.com/v1',
      modelName: 'custom-model'
    })
    await expect(store.getApiKey()).resolves.toBe('secret-token')
  })

  it('migrates legacy config and credential files into the SQLite row', async () => {
    const directoryPath = await createTempDirectory('eve-babel-llm-config-migrate-')
    const legacyConfigPath = join(directoryPath, 'config.json')
    const legacyCredentialPath = join(directoryPath, 'credentials.json')

    await writeFile(
      legacyConfigPath,
      JSON.stringify({
        apiBaseUrl: 'https://legacy.example/v1',
        modelName: 'legacy-model',
        targetLanguage: 'zh-CN'
      }),
      'utf8'
    )
    await writeFile(
      legacyCredentialPath,
      JSON.stringify({
        encryptedApiKey: Buffer.from('legacy-secret', 'utf8').toString('base64')
      }),
      'utf8'
    )

    const store = new LlmConfigStore(join(directoryPath, 'llm-config.sqlite'), legacyConfigPath, legacyCredentialPath)
    const migratedConfig = await store.load()

    expect(migratedConfig).toEqual({
      apiBaseUrl: 'https://legacy.example/v1',
      modelName: 'legacy-model'
    })
    await expect(store.getApiKey()).resolves.toBe('legacy-secret')
    await expect(readFile(`${legacyCredentialPath}.migrated`, 'utf8')).resolves.toContain('encryptedApiKey')
  })
})