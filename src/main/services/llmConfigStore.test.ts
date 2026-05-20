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
  it('stores provider profiles and exposes the active resolved configuration', async () => {
    const directoryPath = await createTempDirectory('eve-babel-llm-config-')
    const store = new LlmConfigStore(join(directoryPath, 'llm-config.sqlite'))

    await store.load()
    const nextConfig = await store.saveProfile({
      providerId: 'openai',
      modelName: 'custom-model',
      apiKey: 'secret-token',
      activate: true
    })

    expect(nextConfig.activeProfileId).toBe(nextConfig.profiles[0]?.profileId ?? null)
    expect(nextConfig.resolvedConfig).toEqual({
      providerId: 'openai',
      apiBaseUrl: 'https://api.openai.com/v1',
      modelName: 'custom-model'
    })
    await expect(store.getActiveApiKey()).resolves.toBe('secret-token')
  })

  it('migrates legacy config and credential files into the SQLite provider profiles table', async () => {
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

    expect(migratedConfig.resolvedConfig).toEqual({
      providerId: 'openai',
      apiBaseUrl: 'https://legacy.example/v1',
      modelName: 'legacy-model'
    })
    expect(migratedConfig.profiles).toHaveLength(1)
    await expect(store.getActiveApiKey()).resolves.toBe('legacy-secret')
    await expect(readFile(`${legacyCredentialPath}.migrated`, 'utf8')).resolves.toContain('encryptedApiKey')
  })

  it('keeps multiple provider profiles and switches the active profile explicitly', async () => {
    const directoryPath = await createTempDirectory('eve-babel-llm-config-switch-')
    const store = new LlmConfigStore(join(directoryPath, 'llm-config.sqlite'))

    await store.load()
    const firstSnapshot = await store.saveProfile({
      providerId: 'openai',
      modelName: 'gpt-4.1-mini',
      apiKey: 'first-secret',
      activate: true
    })
    const firstProfileId = firstSnapshot.activeProfileId

    const secondSnapshot = await store.saveProfile({
      providerId: 'openai',
      modelName: 'gpt-4.1',
      apiKey: 'second-secret',
      activate: false
    })
    const secondProfileId = secondSnapshot.profiles.find((profile) => profile.modelName === 'gpt-4.1')?.profileId

    expect(firstProfileId).toBeTruthy()
    expect(secondProfileId).toBeTruthy()
    expect(secondSnapshot.activeProfileId).toBe(firstProfileId)

    const switchedSnapshot = await store.setActiveProfile(secondProfileId!)

    expect(switchedSnapshot.activeProfileId).toBe(secondProfileId)
    expect(switchedSnapshot.resolvedConfig).toEqual({
      providerId: 'openai',
      apiBaseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4.1'
    })
    await expect(store.getActiveApiKey()).resolves.toBe('second-secret')
  })
})