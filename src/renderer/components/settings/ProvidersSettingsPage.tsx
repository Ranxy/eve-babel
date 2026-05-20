import { useEffect, useRef, useState } from 'react'

import type {
  ApiStatus,
  FetchLlmProviderModelsInput,
  LlmProviderDefinition,
  LlmProviderId,
  LlmProviderModel,
  LlmProviderState,
  SaveLlmProviderProfileInput
} from '../../../shared/types'

interface ProvidersSettingsPageProps {
  apiStatus: ApiStatus
  llmProviderState: LlmProviderState
  forceLlmSetup?: boolean
  onSaveLlmProviderProfile: (input: SaveLlmProviderProfileInput) => void
  onDeleteLlmProviderProfile: (profileId: string) => void
  onSetActiveLlmProviderProfile: (profileId: string) => void
  onFetchLlmProviderModels: (input: FetchLlmProviderModelsInput) => Promise<LlmProviderModel[]>
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7.5C1 7.5 3.5 3 7.5 3C11.5 3 14 7.5 14 7.5C14 7.5 11.5 12 7.5 12C3.5 12 1 7.5 1 7.5Z" />
      <circle cx="7.5" cy="7.5" r="1.8" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1L14 14M6.5 6.7C6.2 7 6 7.5 6 7.5C6 8.3 6.7 9 7.5 9C8 9 8.5 8.8 8.8 8.5" />
      <path d="M3.5 4.5C2.2 5.5 1 7.5 1 7.5C1 7.5 3.5 12 7.5 12C9 12 10.3 11.5 11.3 10.8M5.5 3.5C6.1 3.2 6.8 3 7.5 3C11.5 3 14 7.5 14 7.5C14 7.5 13.2 9 11.8 10.2" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <line x1="10" y1="10" x2="14" y2="14" />
    </svg>
  )
}

function getProviderApiKeyLink(provider: LlmProviderDefinition): string | null {
  if (provider.providerId === 'openai') return 'https://platform.openai.com/api-keys'
  if (provider.providerId === 'deepseek') return 'https://platform.deepseek.com/api_keys'
  return null
}

export function ProvidersSettingsPage(props: ProvidersSettingsPageProps) {
  const { providers, profiles, activeProfileId } = props.llmProviderState

  const [selectedProviderId, setSelectedProviderId] = useState<LlmProviderId>(
    () => providers[0]?.providerId ?? 'openai'
  )
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<LlmProviderModel[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [providerSearch, setProviderSearch] = useState('')
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null)

  const prevProviderIdRef = useRef(selectedProviderId)
  useEffect(() => {
    if (prevProviderIdRef.current !== selectedProviderId) {
      prevProviderIdRef.current = selectedProviderId
      setFetchedModels([])
      setFetchError(null)
      setModelSearchQuery('')
      setApiKey('')
    }
  }, [selectedProviderId])

  const selectedProvider = providers.find((p) => p.providerId === selectedProviderId) ?? providers[0]
  const providerProfiles = profiles.filter((p) => p.providerId === selectedProviderId)
  const referenceProfileId = providerProfiles[0]?.profileId
  const isProviderSelected = activeProfileId ? providerProfiles.some((p) => p.profileId === activeProfileId) : false

  const filteredProviders = providers.filter(
    (p) => !providerSearch.trim() || p.label.toLowerCase().includes(providerSearch.toLowerCase())
  )

  const handleFetch = async () => {
    if (!selectedProvider) return
    setIsFetching(true)
    setFetchError(null)
    try {
      const models = await props.onFetchLlmProviderModels({
        providerId: selectedProvider.providerId,
        profileId: apiKey.trim() ? undefined : referenceProfileId,
        apiKey: apiKey.trim() || undefined
      })
      setFetchedModels(models)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch models')
    } finally {
      setIsFetching(false)
    }
  }

  const handleModelToggle = async (model: LlmProviderModel) => {
    if (!selectedProvider || togglingModelId) return
    const existingProfile = providerProfiles.find((p) => p.modelName === model.modelId)
    setTogglingModelId(model.modelId)
    try {
      if (existingProfile) {
        await props.onDeleteLlmProviderProfile(existingProfile.profileId)
      } else {
        const trimmedKey = apiKey.trim()
        await props.onSaveLlmProviderProfile({
          providerId: selectedProvider.providerId,
          modelName: model.modelId,
          apiKey: trimmedKey || undefined,
          copyApiKeyFromProfileId: trimmedKey ? undefined : referenceProfileId
        })
      }
    } finally {
      setTogglingModelId(null)
    }
  }

  // Combine fetched models with already-saved profiles
  const allModels: LlmProviderModel[] = [
    ...fetchedModels,
    ...providerProfiles
      .filter((p) => !fetchedModels.some((m) => m.modelId === p.modelName))
      .map((p) => ({ modelId: p.modelName, label: p.modelName, ownedBy: null }))
  ]

  const filteredModels = allModels.filter(
    (m) => !modelSearchQuery.trim() || m.modelId.toLowerCase().includes(modelSearchQuery.toLowerCase())
  )

  // Sort: enabled first, then alphabetical
  const sortedModels = [...filteredModels].sort((a, b) => {
    const aOn = providerProfiles.some((p) => p.modelName === a.modelId)
    const bOn = providerProfiles.some((p) => p.modelName === b.modelId)
    if (aOn && !bOn) return -1
    if (!aOn && bOn) return 1
    return a.modelId.localeCompare(b.modelId)
  })

  const enabledCount = providerProfiles.length
  const shownCount = sortedModels.length
  const apiKeyLink = selectedProvider ? getProviderApiKeyLink(selectedProvider) : null

  return (
    <div className="providers-page">
      <div className="providers-toolbar">
        <label className="providers-search-field">
          <SearchIcon />
          <input
            placeholder="Search providers…"
            type="search"
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
          />
        </label>
        <button className="ghost-button" disabled type="button">
          Add Custom Provider
        </button>
      </div>

      <div className="providers-content">
        {/* Left panel: provider list */}
        <div className="providers-list-panel">
          {filteredProviders.map((provider) => {
            const provProfiles = profiles.filter((p) => p.providerId === provider.providerId)
            const isActive = activeProfileId ? provProfiles.some((p) => p.profileId === activeProfileId) : false
            return (
              <button
                key={provider.providerId}
                className={`providers-list-item ${selectedProviderId === provider.providerId ? 'selected' : ''}`}
                type="button"
                onClick={() => setSelectedProviderId(provider.providerId)}
              >
                <span className="providers-list-item-label">{provider.label}</span>
                <span className="providers-list-item-meta">
                  {provProfiles.length > 0 ? (
                    <span className={`chip ${isActive ? 'chip-ok' : 'chip-neutral'}`}>
                      {provProfiles.length} model{provProfiles.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="chip chip-neutral">Not configured</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right panel: provider detail */}
        {selectedProvider && (
          <div className="providers-detail">
            <div className="providers-detail-top">
              <div className="providers-heading-row">
                <h2 className="providers-detail-title">{selectedProvider.label}</h2>
                <span className={`chip ${isProviderSelected ? 'chip-ok' : 'chip-neutral'}`}>
                  {isProviderSelected ? 'Active' : enabledCount > 0 ? `${enabledCount} enabled` : 'Not configured'}
                </span>
              </div>
              <p className="providers-detail-desc">{selectedProvider.description}</p>
            </div>

            <hr className="providers-divider" />

            {/* API Key */}
            <div className="providers-form-section">
              <div className="providers-form-section-head">
                <span className="eyebrow">API Key</span>
              </div>
              <div className="providers-api-key-row">
                <div className="providers-api-key-field">
                  <input
                    autoComplete="off"
                    placeholder={referenceProfileId ? 'Leave blank to use stored key' : 'Paste your API key…'}
                    spellCheck={false}
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button
                    className="providers-eye-btn"
                    title={showApiKey ? 'Hide key' : 'Show key'}
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                  >
                    {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {apiKeyLink && (
                  <a className="providers-key-link" href={apiKeyLink} rel="noreferrer" target="_blank">
                    Get API key ↗
                  </a>
                )}
              </div>
            </div>

            <hr className="providers-divider" />

            {/* Models */}
            <div className="providers-form-section providers-models-section">
              <div className="providers-form-section-head">
                <span className="eyebrow">Models</span>
                <button className="ghost-button" disabled={isFetching} type="button" onClick={handleFetch}>
                  {isFetching ? 'Fetching…' : 'Fetch models'}
                </button>
              </div>

              {fetchError && <div className="providers-fetch-error">{fetchError}</div>}

              {sortedModels.length > 0 && (
                <>
                  <label className="providers-search-field providers-model-search">
                    <SearchIcon />
                    <input
                      placeholder="Search models…"
                      type="search"
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                    />
                  </label>
                  <div className="providers-model-count">
                    Showing {shownCount} model{shownCount !== 1 ? 's' : ''} · {enabledCount} enabled
                  </div>
                  <div className="providers-model-list">
                    {sortedModels.map((model) => {
                      const existingProfile = providerProfiles.find((p) => p.modelName === model.modelId)
                      const isEnabled = Boolean(existingProfile)
                      const isToggling = togglingModelId === model.modelId
                      return (
                        <div className="providers-model-row" key={model.modelId}>
                          <div className="providers-model-info">
                            <span className="providers-model-name">{model.modelId}</span>
                            {model.ownedBy && (
                              <span className="providers-model-owned">{model.ownedBy}</span>
                            )}
                          </div>
                          <label className={`toggle-switch ${isToggling ? 'toggle-switch-busy' : ''}`}>
                            <input
                              checked={isEnabled}
                              disabled={isToggling}
                              type="checkbox"
                              onChange={() => { void handleModelToggle(model) }}
                            />
                            <span className="toggle-switch-track" />
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {!isFetching && sortedModels.length === 0 && (
                <div className="providers-empty-models">
                  {referenceProfileId
                    ? 'Click "Fetch models" to load available models.'
                    : 'Enter an API key and click "Fetch models" to see available models.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
