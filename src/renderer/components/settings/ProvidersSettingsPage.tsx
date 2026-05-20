import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  ApiStatus,
  FetchLlmProviderModelsInput,
  LlmProviderDefinition,
  LlmProviderId,
  LlmProviderModel,
  LlmProviderProfile,
  LlmProviderState,
  SaveLlmProviderProfileInput
} from '../../../shared/types'

interface ProvidersSettingsPageProps {
  apiStatus: ApiStatus
  llmProviderState: LlmProviderState
  forceLlmSetup?: boolean
  onSaveLlmProviderProfile: (input: SaveLlmProviderProfileInput) => void
  onSetActiveLlmProviderProfile: (profileId: string) => void
  onFetchLlmProviderModels: (input: FetchLlmProviderModelsInput) => Promise<LlmProviderModel[]>
}

export function ProvidersSettingsPage(props: ProvidersSettingsPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProviderId, setSelectedProviderId] = useState<LlmProviderId>(() => props.llmProviderState.providers[0]?.providerId ?? 'openai')
  const [editingProfileId, setEditingProfileId] = useState<string | null>(() => props.llmProviderState.activeProfileId)
  const [profileFormState, setProfileFormState] = useState({
    modelName: '',
    apiKey: ''
  })
  const [availableModels, setAvailableModels] = useState<LlmProviderModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [modelLoadError, setModelLoadError] = useState<string | null>(null)
  const [modelRefreshNonce, setModelRefreshNonce] = useState(0)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const apiKeyRef = useRef<HTMLInputElement | null>(null)
  const hasAppliedInitialFocus = useRef(false)
  const lastModelRequestKeyRef = useRef<string | null>(null)

  const filteredProviders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) {
      return props.llmProviderState.providers
    }
    return props.llmProviderState.providers.filter((provider) => `${provider.label} ${provider.description}`.toLowerCase().includes(normalizedQuery))
  }, [props.llmProviderState.providers, searchQuery])

  useEffect(() => {
    const currentProviderExists = props.llmProviderState.providers.some((provider) => provider.providerId === selectedProviderId)
    if (!currentProviderExists && props.llmProviderState.providers[0]) {
      setSelectedProviderId(props.llmProviderState.providers[0].providerId)
    }
  }, [props.llmProviderState.providers, selectedProviderId])

  useEffect(() => {
    if (filteredProviders.length === 0) {
      return
    }
    const isSelectedProviderVisible = filteredProviders.some((provider) => provider.providerId === selectedProviderId)
    if (!isSelectedProviderVisible) {
      setSelectedProviderId(filteredProviders[0].providerId)
    }
  }, [filteredProviders, selectedProviderId])

  const selectedProvider =
    props.llmProviderState.providers.find((provider) => provider.providerId === selectedProviderId) ?? filteredProviders[0] ?? null
  const providerProfiles = props.llmProviderState.profiles.filter((profile) => profile.providerId === selectedProviderId)
  const activeProviderProfile = providerProfiles.find((profile) => profile.isActive) ?? null
  const editingProfile = providerProfiles.find((profile) => profile.profileId === editingProfileId) ?? null
  const canSaveProviderProfile = Boolean(
    selectedProvider && profileFormState.modelName.trim() && (profileFormState.apiKey.trim() || editingProfile?.hasApiKey)
  )
  const activatableProfile = editingProfile ?? providerProfiles[0] ?? null

  useEffect(() => {
    const nextEditingProfileId = resolveEditingProfileId(providerProfiles, editingProfileId)
    if (nextEditingProfileId !== editingProfileId) {
      setEditingProfileId(nextEditingProfileId)
    }
  }, [editingProfileId, providerProfiles])

  useEffect(() => {
    setProfileFormState({
      modelName: editingProfile?.modelName ?? '',
      apiKey: ''
    })
    setAvailableModels([])
    setModelLoadError(null)
    lastModelRequestKeyRef.current = null
  }, [editingProfile?.profileId, selectedProviderId])

  useEffect(() => {
    if (hasAppliedInitialFocus.current) {
      return
    }
    const target = props.forceLlmSetup ? apiKeyRef.current : searchInputRef.current ?? apiKeyRef.current
    target?.focus()
    hasAppliedInitialFocus.current = true
  }, [props.forceLlmSetup])

  useEffect(() => {
    if (!selectedProvider) {
      setAvailableModels([])
      setModelLoadError(null)
      setIsLoadingModels(false)
      return
    }

    const trimmedApiKey = profileFormState.apiKey.trim()
    const hasStoredApiKey = Boolean(editingProfile?.hasApiKey)
    if (!trimmedApiKey && !hasStoredApiKey) {
      setAvailableModels([])
      setModelLoadError(null)
      setIsLoadingModels(false)
      lastModelRequestKeyRef.current = null
      return
    }

    const requestKey = `${selectedProvider.providerId}::${editingProfile?.profileId ?? 'new'}::${trimmedApiKey || '[stored]'}::${modelRefreshNonce}`
    if (requestKey === lastModelRequestKeyRef.current) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      lastModelRequestKeyRef.current = requestKey
      setIsLoadingModels(true)
      setModelLoadError(null)

      void props
        .onFetchLlmProviderModels({
          providerId: selectedProvider.providerId,
          profileId: editingProfile?.profileId ?? undefined,
          apiKey: trimmedApiKey || undefined
        })
        .then((models) => {
          setAvailableModels(models)
          setProfileFormState((current) => {
            const nextModelName = chooseModelName(current.modelName, editingProfile?.modelName ?? '', models)
            return nextModelName === current.modelName ? current : { ...current, modelName: nextModelName }
          })
        })
        .catch((error) => {
          setAvailableModels([])
          setModelLoadError(error instanceof Error ? error.message : 'Failed to load provider models')
        })
        .finally(() => {
          setIsLoadingModels(false)
        })
    }, 360)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [editingProfile?.hasApiKey, editingProfile?.modelName, editingProfile?.profileId, modelRefreshNonce, profileFormState.apiKey, props.onFetchLlmProviderModels, selectedProvider])

  const mergedModelOptions = mergeModelOptions(availableModels, profileFormState.modelName)

  return (
    <div className="providers-page">
      {props.forceLlmSetup ? (
        <div className="settings-note providers-setup-note">
          <span className="settings-note-label">Setup required</span>
          <strong>Translation stays paused until one provider profile is active.</strong>
          <span className="settings-field-hint">Add an API key, wait for model discovery, then save and activate the provider profile.</span>
        </div>
      ) : null}

      {/* Toolbar: search + action buttons */}
      <div className="providers-toolbar">
        <label className="providers-search-field">
          <svg className="providers-search-icon-svg" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="6" cy="6" r="4.5" />
            <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" />
          </svg>
          <input
            ref={searchInputRef}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search providers..."
            value={searchQuery}
          />
        </label>
        <button className="ghost-button" disabled title="Custom providers coming soon" type="button">
          Add Custom Provider
        </button>
      </div>

      {/* Two-column layout: list + detail */}
      <div className="providers-content">
        {/* Provider list */}
        <div className="providers-list-panel">
          {filteredProviders.length > 0 ? (
            filteredProviders.map((provider) => {
              const providerStatus = getProviderStatus(provider.providerId, props.llmProviderState.profiles)
              return (
                <button
                  className={`providers-list-item ${provider.providerId === selectedProviderId ? 'selected' : ''}`}
                  key={provider.providerId}
                  onClick={() => setSelectedProviderId(provider.providerId)}
                  type="button"
                >
                  <span className="providers-list-item-icon">{getProviderGlyph(provider)}</span>
                  <span className="providers-list-item-label">{provider.label}</span>
                  <span className={`providers-status-dot is-${providerStatus}`} aria-hidden="true" />
                </button>
              )
            })
          ) : (
            <div className="empty-state providers-empty-list">
              <div>
                <strong>No providers match.</strong>
                <p className="hero-copy">Try another keyword or clear the search.</p>
              </div>
            </div>
          )}
        </div>

        {/* Provider detail */}
        {selectedProvider ? (
          <div className="providers-detail">
            {/* Header: name, badge, description, enable button */}
            <div className="providers-detail-top">
              <div className="providers-heading-row">
                <h2>{selectedProvider.label}</h2>
                <span className={`chip ${activeProviderProfile ? 'chip-ok' : 'chip-neutral'}`}>
                  {activeProviderProfile ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="hero-copy providers-detail-desc">{selectedProvider.description}</p>
              <div className="providers-detail-top-actions">
                <button
                  className="primary-button"
                  disabled={!activatableProfile || activeProviderProfile?.profileId === activatableProfile?.profileId}
                  onClick={() => {
                    if (activatableProfile) {
                      props.onSetActiveLlmProviderProfile(activatableProfile.profileId)
                    }
                  }}
                  type="button"
                >
                  {activeProviderProfile ? 'Using Provider' : 'Enable Provider'}
                </button>
              </div>
            </div>

            <hr className="providers-divider" />

            {/* Setup form */}
            <div className="providers-form-section">
              <div className="providers-form-section-head">
                <div>
                  <div className="eyebrow">Provider Setup</div>
                  <p className="providers-form-section-title">
                    {editingProfile ? buildProfileLabel(selectedProvider.label, editingProfile) : `Add ${selectedProvider.label}`}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`chip ${canSaveProviderProfile ? 'chip-ok' : 'chip-neutral'}`}>
                    {canSaveProviderProfile ? 'Ready' : 'Needs model and key'}
                  </span>
                  {providerProfiles.length > 0 ? (
                    <button
                      className="ghost-button"
                      onClick={() => {
                        setEditingProfileId(null)
                        setProfileFormState({ modelName: '', apiKey: '' })
                        setAvailableModels([])
                        setModelLoadError(null)
                        lastModelRequestKeyRef.current = null
                      }}
                      type="button"
                    >
                      New profile
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="providers-form-grid">
                <label className="settings-field">
                  <span className="settings-field-label">API key</span>
                  <input
                    ref={apiKeyRef}
                    onChange={(event) => {
                      const nextApiKey = event.target.value
                      setProfileFormState((current) => ({ ...current, apiKey: nextApiKey }))
                      setModelLoadError(null)
                      lastModelRequestKeyRef.current = null
                    }}
                    placeholder={editingProfile?.hasApiKey ? 'Leave blank to keep the stored key' : 'Required to load models'}
                    type="password"
                    value={profileFormState.apiKey}
                  />
                  <span className="settings-field-hint">
                    {editingProfile?.hasApiKey ? 'Leave this blank to keep the stored key.' : 'The model list loads automatically after a valid key is entered.'}
                  </span>
                </label>

                <label className="settings-field">
                  <span className="settings-field-label">Model</span>
                  <select
                    disabled={mergedModelOptions.length === 0}
                    onChange={(event) => setProfileFormState((current) => ({ ...current, modelName: event.target.value }))}
                    value={profileFormState.modelName}
                  >
                    <option value="">{isLoadingModels ? 'Loading models...' : 'Select a discovered model'}</option>
                    {mergedModelOptions.map((model) => (
                      <option key={model.modelId} value={model.modelId}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  <span className="settings-field-hint">
                    {modelLoadError
                      ? modelLoadError
                      : isLoadingModels
                        ? 'Querying the provider for available models.'
                        : mergedModelOptions.length > 0
                          ? `${mergedModelOptions.length} models available.`
                          : 'Enter an API key to load models.'}
                  </span>
                </label>
              </div>

              <div className="settings-action-row">
                <button
                  className="ghost-button"
                  disabled={isLoadingModels}
                  onClick={() => {
                    lastModelRequestKeyRef.current = null
                    setModelLoadError(null)
                    setAvailableModels([])
                    setModelRefreshNonce((current) => current + 1)
                  }}
                  type="button"
                >
                  Refresh models
                </button>
                <button
                  className="primary-button"
                  disabled={!canSaveProviderProfile}
                  onClick={() => {
                    props.onSaveLlmProviderProfile({
                      profileId: editingProfile?.profileId ?? undefined,
                      providerId: selectedProvider.providerId,
                      modelName: profileFormState.modelName.trim(),
                      apiKey: profileFormState.apiKey.trim() || undefined,
                      activate: true
                    })
                    setProfileFormState((current) => ({ ...current, apiKey: '' }))
                  }}
                  type="button"
                >
                  {editingProfile ? 'Save and activate' : 'Create and activate'}
                </button>
              </div>
            </div>

            {/* Saved profiles */}
            {providerProfiles.length > 0 ? (
              <>
                <hr className="providers-divider" />
                <div className="providers-profiles-section">
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Saved Profiles</div>
                  <div className="providers-profile-list">
                    {providerProfiles.map((profile) => (
                      <article className={`providers-profile-row ${profile.isActive ? 'active' : ''}`} key={profile.profileId}>
                        <div className="providers-profile-row-copy">
                          <strong>{buildProfileLabel(selectedProvider.label, profile)}</strong>
                          <span>
                            {profile.hasApiKey ? 'API key stored' : 'API key missing'} · Updated {formatTimestamp(profile.updatedAt)}
                          </span>
                        </div>
                        <div className="providers-profile-row-actions">
                          {profile.isActive ? <span className="chip chip-ok">active</span> : null}
                          <button
                            className="ghost-button"
                            disabled={profile.isActive}
                            onClick={() => props.onSetActiveLlmProviderProfile(profile.profileId)}
                            type="button"
                          >
                            Use
                          </button>
                          <button className="ghost-button" onClick={() => setEditingProfileId(profile.profileId)} type="button">
                            Edit
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state providers-empty-profiles">
                <div>
                  <strong>Create the first {selectedProvider.label} profile.</strong>
                  <p className="hero-copy">Enter an API key and choose one of the discovered models.</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function resolveEditingProfileId(profiles: LlmProviderProfile[], currentProfileId: string | null): string | null {
  if (currentProfileId && profiles.some((profile) => profile.profileId === currentProfileId)) {
    return currentProfileId
  }
  return profiles.find((profile) => profile.isActive)?.profileId ?? profiles[0]?.profileId ?? null
}

function chooseModelName(currentModelName: string, profileModelName: string, models: LlmProviderModel[]): string {
  if (currentModelName && models.some((model) => model.modelId === currentModelName)) {
    return currentModelName
  }
  if (profileModelName && models.some((model) => model.modelId === profileModelName)) {
    return profileModelName
  }
  return models[0]?.modelId ?? currentModelName
}

function mergeModelOptions(models: LlmProviderModel[], currentModelName: string): LlmProviderModel[] {
  const map = new Map(models.map((model) => [model.modelId, model]))
  if (currentModelName && !map.has(currentModelName)) {
    map.set(currentModelName, {
      modelId: currentModelName,
      label: `${currentModelName} (current)`,
      ownedBy: null
    })
  }
  return Array.from(map.values())
}

function getProviderStatus(providerId: LlmProviderId, profiles: LlmProviderProfile[]): 'active' | 'ready' | 'empty' {
  const providerProfiles = profiles.filter((profile) => profile.providerId === providerId)
  if (providerProfiles.some((profile) => profile.isActive)) {
    return 'active'
  }
  return providerProfiles.length > 0 ? 'ready' : 'empty'
}

function buildProfileLabel(providerLabel: string, profile: LlmProviderProfile): string {
  return `${providerLabel} / ${profile.modelName}`
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function getProviderGlyph(provider: LlmProviderDefinition): string {
  const normalized = provider.label.replace(/[^A-Za-z0-9]/g, '')
  return normalized.slice(0, 2).toUpperCase() || 'AI'
}
