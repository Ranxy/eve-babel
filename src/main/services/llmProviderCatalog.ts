import type { FetchLlmProviderModelsInput, LlmProviderDefinition, LlmProviderId, LlmProviderModel } from '../../shared/types'

const BUILTIN_PROVIDER_DEFINITIONS: LlmProviderDefinition[] = [
  {
    providerId: 'openai',
    label: 'OpenAI',
    description: 'OpenAI GPT models for chat translation.',
    defaultApiBaseUrl: 'https://api.openai.com/v1'
  },
  {
    providerId: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek AI models.',
    defaultApiBaseUrl: 'https://api.deepseek.com'
  },
  {
    providerId: 'openrouter',
    label: 'OpenRouter',
    description: 'OpenRouter aggregates hundreds of models from multiple providers via a single API.',
    defaultApiBaseUrl: 'https://openrouter.ai/api/v1'
  },
  {
    providerId: 'custom',
    label: 'Custom',
    description: 'User-defined OpenAI-compatible API endpoint.',
    defaultApiBaseUrl: ''
  }
]

interface ProviderModelResponse {
  data?: Array<{
    id?: string
    owned_by?: string
  }>
  error?: {
    message?: string
  }
}

export function getBuiltinLlmProviders(): LlmProviderDefinition[] {
  return BUILTIN_PROVIDER_DEFINITIONS.map((provider) => ({ ...provider }))
}

export function getLlmProviderDefinition(providerId: LlmProviderId): LlmProviderDefinition {
  const provider = BUILTIN_PROVIDER_DEFINITIONS.find((entry) => entry.providerId === providerId)

  if (!provider) {
    throw new Error(`Unsupported provider: ${providerId}`)
  }

  return { ...provider }
}

export async function fetchBuiltinProviderModels(input: FetchLlmProviderModelsInput & { apiKey: string }): Promise<LlmProviderModel[]> {
  const provider = getLlmProviderDefinition(input.providerId)
  const baseUrl = (input.apiBaseUrl?.trim() || provider.defaultApiBaseUrl).replace(/\/+$/, '')

  switch (input.providerId) {
    case 'openai':
    case 'deepseek':
    case 'openrouter':
    case 'custom': {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${input.apiKey.trim()}`
        }
      })

      const rawText = await response.text()
      const payload = parseJsonSafely(rawText) as ProviderModelResponse

      if (!response.ok) {
        const detail = payload?.error?.message?.trim()
        throw new Error(`Failed to load ${provider.label} models (${response.status})${detail ? `: ${detail}` : ''}`)
      }

      const models = (payload.data ?? [])
        .map((entry) => {
          const modelId = entry.id?.trim() ?? ''
          if (!modelId) {
            return null
          }

          return {
            modelId,
            label: modelId,
            ownedBy: entry.owned_by?.trim() || null
          }
        })
        .filter((entry): entry is LlmProviderModel => entry !== null)
        .sort((left, right) => compareModelPriority(left.modelId, right.modelId))

      if (models.length === 0) {
        throw new Error(`No models were returned by ${provider.label}.`)
      }

      return models
    }
    default:
      throw new Error(`Unsupported provider: ${input.providerId}`)
  }
}

function compareModelPriority(left: string, right: string): number {
  const rankDifference = getModelRank(left) - getModelRank(right)
  if (rankDifference !== 0) {
    return rankDifference
  }

  return left.localeCompare(right)
}

function getModelRank(modelId: string): number {
  if (/^gpt-4\.1/u.test(modelId)) {
    return 0
  }

  if (/^gpt-4o/u.test(modelId)) {
    return 1
  }

  if (/^gpt-4/u.test(modelId)) {
    return 2
  }

  if (/^gpt-3\.5/u.test(modelId)) {
    return 3
  }

  if (/^deepseek-chat/u.test(modelId)) {
    return 0
  }

  if (/^deepseek-reasoner/u.test(modelId)) {
    return 1
  }

  if (/^deepseek/u.test(modelId)) {
    return 2
  }

  return 10
}

function parseJsonSafely(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
