import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchBuiltinProviderModels } from './llmProviderCatalog'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('llmProviderCatalog', () => {
  it('loads and prioritizes OpenAI models from the provider endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [
              { id: 'gpt-3.5-turbo', owned_by: 'openai' },
              { id: 'gpt-4.1-mini', owned_by: 'openai' },
              { id: 'gpt-4o-mini', owned_by: 'openai' }
            ]
          })
      })
    )

    const models = await fetchBuiltinProviderModels({
      providerId: 'openai',
      apiKey: 'token'
    })

    expect(models).toEqual([
      { modelId: 'gpt-4.1-mini', label: 'gpt-4.1-mini', ownedBy: 'openai' },
      { modelId: 'gpt-4o-mini', label: 'gpt-4o-mini', ownedBy: 'openai' },
      { modelId: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo', ownedBy: 'openai' }
    ])
  })

  it('throws a readable error when the provider model request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'invalid key' } })
      })
    )

    await expect(
      fetchBuiltinProviderModels({
        providerId: 'openai',
        apiKey: 'bad-token'
      })
    ).rejects.toThrow('Failed to load OpenAI models (401)')
  })
})
