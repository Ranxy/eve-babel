import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="7.5" y1="2" x2="7.5" y2="13" />
      <line x1="2" y1="7.5" x2="13" y2="7.5" />
    </svg>
  )
}

function getProviderApiKeyLink(provider: LlmProviderDefinition): string | null {
  if (provider.providerId === 'openai') return 'https://platform.openai.com/api-keys'
  if (provider.providerId === 'deepseek') return 'https://platform.deepseek.com/api_keys'
  if (provider.providerId === 'openrouter') return 'https://openrouter.ai/settings/keys'
  return null
}

// Sentinel value meaning "show the new-custom form"
const NEW_CUSTOM_SENTINEL = '__new__'

export function ProvidersSettingsPage(props: ProvidersSettingsPageProps) {
  const { t } = useTranslation()
  const { providers, profiles, activeProfileId } = props.llmProviderState

  // Built-in provider selection
  const [selectedProviderId, setSelectedProviderId] = useState<LlmProviderId>(
    () => providers[0]?.providerId ?? 'openai'
  )

  // Custom provider selection: null = none, NEW_CUSTOM_SENTINEL = new form, UUID = existing
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null)
  const isCustomMode = selectedCustomId !== null

  // Built-in state
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isEditingKey, setIsEditingKey] = useState(false)
  const [storedKeyValue, setStoredKeyValue] = useState<string | null>(null)
  const [showStoredKey, setShowStoredKey] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<LlmProviderModel[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null)

  // Custom form state
  const [customName, setCustomName] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customModelName, setCustomModelName] = useState('')
  const [customApiKey, setCustomApiKey] = useState('')
  const [customShowApiKey, setCustomShowApiKey] = useState(false)
  const [customIsEditingKey, setCustomIsEditingKey] = useState(false)
  const [customStoredKeyValue, setCustomStoredKeyValue] = useState<string | null>(null)
  const [customShowStoredKey, setCustomShowStoredKey] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)

  // Shared
  const [providerSearch, setProviderSearch] = useState('')

  // Reset built-in state when provider changes
  const prevProviderIdRef = useRef(selectedProviderId)
  useEffect(() => {
    if (prevProviderIdRef.current !== selectedProviderId) {
      prevProviderIdRef.current = selectedProviderId
      setFetchedModels([])
      setFetchError(null)
      setModelSearchQuery('')
      setApiKey('')
      setShowApiKey(false)
      setIsEditingKey(false)
      setStoredKeyValue(null)
      setShowStoredKey(false)
    }
  }, [selectedProviderId])

  // Reset custom form when custom selection changes
  const prevCustomIdRef = useRef(selectedCustomId)
  useEffect(() => {
    if (prevCustomIdRef.current !== selectedCustomId) {
      prevCustomIdRef.current = selectedCustomId
      setCustomError(null)
      setCustomApiKey('')
      setCustomShowApiKey(false)
      setCustomIsEditingKey(false)
      setCustomStoredKeyValue(null)
      setCustomShowStoredKey(false)

      if (selectedCustomId && selectedCustomId !== NEW_CUSTOM_SENTINEL) {
        const profile = profiles.find((p) => p.profileId === selectedCustomId)
        setCustomName(profile?.customLabel ?? '')
        setCustomBaseUrl(profile?.apiBaseUrl ?? '')
        setCustomModelName(profile?.modelName ?? '')
      } else {
        setCustomName('')
        setCustomBaseUrl('')
        setCustomModelName('')
      }
    }
  }, [selectedCustomId, profiles])

  // Derived: built-in
  const builtinProviders = providers.filter((p) => p.providerId !== 'custom')
  const selectedProvider = builtinProviders.find((p) => p.providerId === selectedProviderId) ?? builtinProviders[0]
  const providerProfiles = profiles.filter((p) => p.providerId === selectedProviderId)
  const referenceProfileId = providerProfiles[0]?.profileId
  const isProviderSelected = activeProfileId ? providerProfiles.some((p) => p.profileId === activeProfileId) : false
  const hasStoredKey = Boolean(referenceProfileId) && providerProfiles[0]?.hasApiKey
  const inStoredKeyMode = hasStoredKey && !isEditingKey

  // Derived: custom
  const customProfiles = profiles.filter((p) => p.providerId === 'custom')
  const selectedCustomProfile =
    selectedCustomId && selectedCustomId !== NEW_CUSTOM_SENTINEL
      ? (customProfiles.find((p) => p.profileId === selectedCustomId) ?? null)
      : null
  const customIsActive = Boolean(selectedCustomProfile && activeProfileId === selectedCustomProfile.profileId)
  const customHasStoredKey = Boolean(selectedCustomProfile?.hasApiKey)
  const customInStoredKeyMode = customHasStoredKey && !customIsEditingKey

  // Derived: model list for built-in
  const allModels: LlmProviderModel[] = [
    ...fetchedModels,
    ...providerProfiles
      .filter((p) => !fetchedModels.some((m) => m.modelId === p.modelName))
      .map((p) => ({ modelId: p.modelName, label: p.modelName, ownedBy: null }))
  ]
  const filteredModels = allModels.filter(
    (m) => !modelSearchQuery.trim() || m.modelId.toLowerCase().includes(modelSearchQuery.toLowerCase())
  )
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

  // Filtered lists for left panel
  const filteredBuiltins = builtinProviders.filter(
    (p) => !providerSearch.trim() || p.label.toLowerCase().includes(providerSearch.toLowerCase())
  )
  const filteredCustomProfiles = customProfiles.filter(
    (p) => !providerSearch.trim() || (p.customLabel ?? '').toLowerCase().includes(providerSearch.toLowerCase())
  )

  // Handlers: selection
  const handleSelectBuiltin = (providerId: LlmProviderId) => {
    setSelectedProviderId(providerId)
    setSelectedCustomId(null)
  }

  const handleSelectCustom = (profileId: string) => {
    setSelectedCustomId(profileId)
  }

  const handleAddCustom = () => {
    setSelectedCustomId(NEW_CUSTOM_SENTINEL)
  }

  // Handlers: built-in
  const handleToggleStoredKey = async () => {
    if (showStoredKey) {
      setShowStoredKey(false)
      setStoredKeyValue(null)
      return
    }
    if (!storedKeyValue && referenceProfileId) {
      const key = await window.eveBabel.getApiKeyForProfile(referenceProfileId)
      setStoredKeyValue(key)
    }
    setShowStoredKey(true)
  }

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
      setFetchError(err instanceof Error ? err.message : t('providersSettings.models.failedToFetch'))
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

  // Handlers: custom
  const handleToggleCustomStoredKey = async () => {
    if (customShowStoredKey) {
      setCustomShowStoredKey(false)
      setCustomStoredKeyValue(null)
      return
    }
    if (!customStoredKeyValue && selectedCustomProfile) {
      const key = await window.eveBabel.getApiKeyForProfile(selectedCustomProfile.profileId)
      setCustomStoredKeyValue(key)
    }
    setCustomShowStoredKey(true)
  }

  const handleSaveCustom = () => {
    if (!customName.trim()) { setCustomError(t('providersSettings.validation.nameRequired')); return }
    if (!customBaseUrl.trim()) { setCustomError(t('providersSettings.validation.urlRequired')); return }
    if (!customModelName.trim()) { setCustomError(t('providersSettings.validation.modelRequired')); return }
    setCustomError(null)

    const isNew = selectedCustomId === NEW_CUSTOM_SENTINEL
    props.onSaveLlmProviderProfile({
      profileId: isNew ? undefined : (selectedCustomId ?? undefined),
      providerId: 'custom',
      customLabel: customName.trim(),
      apiBaseUrl: customBaseUrl.trim(),
      modelName: customModelName.trim(),
      apiKey: customApiKey.trim() || undefined
    })

    if (isNew) {
      setSelectedCustomId(null)
    } else {
      setCustomApiKey('')
      setCustomIsEditingKey(false)
    }
  }

  const handleDeleteCustom = () => {
    if (!selectedCustomId || selectedCustomId === NEW_CUSTOM_SENTINEL) return
    props.onDeleteLlmProviderProfile(selectedCustomId)
    setSelectedCustomId(null)
  }

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <div className="flex items-center gap-2 shrink-0">
        <label className="flex items-center gap-2.5 flex-1 border border-border rounded-lg bg-input-surface px-3.5 min-h-[38px] cursor-text focus-within:outline-2 focus-within:outline-[rgba(111,140,149,0.28)] focus-within:outline-offset-0 focus-within:rounded-lg">
          <SearchIcon />
          <input
            placeholder={t('providersSettings.searchPlaceholder')}
            type="search"
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
          />
        </label>
        <button className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px flex items-center gap-1.5" type="button" onClick={handleAddCustom}>
          <PlusIcon />
          {t('providersSettings.addCustomProvider')}
        </button>
      </div>

      <div className="grid grid-cols-[220px_minmax(0,1fr)] min-h-0 flex-1 border border-border rounded-2xl overflow-hidden">
        {/* Left panel */}
        <div className="border-r border-border p-2 overflow-y-auto flex flex-col gap-0.5 bg-[rgba(246,248,251,0.5)] dark:bg-[rgba(18,26,36,0.4)]">
          {filteredBuiltins.map((provider) => {
            const provProfiles = profiles.filter((p) => p.providerId === provider.providerId)
            const isActive = activeProfileId ? provProfiles.some((p) => p.profileId === activeProfileId) : false
            return (
              <button
                key={provider.providerId}
                className={`flex items-center gap-2.5 py-2 px-2.5 border border-transparent rounded-[10px] bg-transparent text-inherit text-left w-full cursor-pointer hover:bg-row-hover-surface ${!isCustomMode && selectedProviderId === provider.providerId ? 'selected' : ''}`}
                type="button"
                onClick={() => handleSelectBuiltin(provider.providerId)}
              >
                <span className="flex-1 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{provider.label}</span>
                <span className="ml-auto">
                  {provProfiles.length > 0 ? (
                    <span className={`inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full text-xs font-bold ${isActive ? 'bg-[rgba(44,106,70,0.16)] text-ok' : 'bg-accent-cold-soft text-accent-cold'}`}>
                      {t('providersSettings.status.model', { count: provProfiles.length })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full bg-accent-cold-soft text-accent-cold text-xs font-bold">{t('providersSettings.notConfigured')}</span>
                  )}
                </span>
              </button>
            )
          })}

          {(filteredCustomProfiles.length > 0 || selectedCustomId === NEW_CUSTOM_SENTINEL) && (
            <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-muted py-3 px-3 pb-1">{t('providersSettings.customSection')}</div>
          )}

          {filteredCustomProfiles.map((profile) => {
            const isActive = activeProfileId === profile.profileId
            return (
              <button
                key={profile.profileId}
                className={`flex items-center gap-2.5 py-2 px-2.5 border border-transparent rounded-[10px] bg-transparent text-inherit text-left w-full cursor-pointer hover:bg-row-hover-surface ${selectedCustomId === profile.profileId ? 'selected' : ''}`}
                type="button"
                onClick={() => handleSelectCustom(profile.profileId)}
              >
                <span className="flex-1 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{profile.customLabel || t('providersSettings.unnamedProvider')}</span>
                <span className="ml-auto">
                  <span className={`inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full text-xs font-bold ${isActive ? 'bg-[rgba(44,106,70,0.16)] text-ok' : 'bg-accent-cold-soft text-accent-cold'}`}>
                    {isActive ? t('providersSettings.status.active') : profile.modelName}
                  </span>
                </span>
              </button>
            )
          })}

          {selectedCustomId === NEW_CUSTOM_SENTINEL && (
            <button
              className="flex items-center gap-2.5 py-2 px-2.5 border border-transparent rounded-[10px] bg-transparent text-inherit text-left w-full cursor-pointer hover:bg-row-hover-surface selected flex items-center gap-2.5 py-2 px-2.5 border border-transparent rounded-[10px] bg-transparent text-inherit text-left w-full cursor-pointer hover:bg-row-hover-surface-draft"
              type="button"
              onClick={handleAddCustom}
            >
              <span className="flex-1 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{t('providersSettings.newCustomProvider')}</span>
              <span className="ml-auto">
                <span className="inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full bg-accent-cold-soft text-accent-cold text-xs font-bold">{t('providersSettings.draft')}</span>
              </span>
            </button>
          )}
        </div>

        {/* Right panel */}
        {isCustomMode ? (
          <div className="p-5 overflow-y-auto flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold m-0">
                  {selectedCustomId === NEW_CUSTOM_SENTINEL ? t('providersSettings.newCustomProvider') : (customName || t('providersSettings.customProvider'))}
                </h2>
                {selectedCustomId !== NEW_CUSTOM_SENTINEL && (
                  <span className={`inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full text-xs font-bold ${customIsActive ? 'bg-[rgba(44,106,70,0.16)] text-ok' : 'bg-accent-cold-soft text-accent-cold'}`}>
                    {customIsActive ? t('providersSettings.status.active') : t('providersSettings.status.inactive')}
                  </span>
                )}
              </div>
              <p className="text-muted text-[13px] mt-1 max-w-[56ch]">
                {t('providersSettings.customDescription')}
              </p>
            </div>

            <hr className="border-none border-t border-border m-0" />

            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('providersSettings.displayName.eyebrow')}</span>
              </div>
              <input
                className="w-full box-border bg-input-surface border border-border rounded-lg py-[7px] px-3 text-sm text-text outline-none focus:border-accent focus:outline-2 focus:outline-[rgba(111,140,149,0.28)] focus:outline-offset-0 placeholder:text-muted"
                placeholder={t('providersSettings.displayName.placeholder')}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>

            <hr className="border-none border-t border-border m-0" />

            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('providersSettings.apiBaseUrl.eyebrow')}</span>
              </div>
              <input
                className="w-full box-border bg-input-surface border border-border rounded-lg py-[7px] px-3 text-sm text-text outline-none focus:border-accent focus:outline-2 focus:outline-[rgba(111,140,149,0.28)] focus:outline-offset-0 placeholder:text-muted"
                placeholder={t('providersSettings.apiBaseUrl.placeholder')}
                spellCheck={false}
                type="url"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
              />
            </div>

            <hr className="border-none border-t border-border m-0" />

            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('providersSettings.apiKey.eyebrow')}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex flex-1 items-center relative">
                  {customInStoredKeyMode ? (
                    <>
                      <input
                        readOnly
                        spellCheck={false}
                        type="text"
                        value={customShowStoredKey ? (customStoredKeyValue ?? '..............') : '...............'}
                        title={t('providersSettings.apiKey.replaceTitle')}
                        style={{ cursor: 'pointer', letterSpacing: customShowStoredKey ? undefined : '0.1em' }}
                        onClick={() => { setCustomIsEditingKey(true); setCustomShowStoredKey(false); setCustomStoredKeyValue(null) }}
                      />
                      <button
                        className="absolute right-2 bg-none border-none cursor-pointer text-muted p-0.5 flex items-center hover:text-text"
                        title={customShowStoredKey ? t('providersSettings.apiKey.hideKey') : t('providersSettings.apiKey.showKey')}
                        type="button"
                        onClick={() => { void handleToggleCustomStoredKey() }}
                      >
                        {customShowStoredKey ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        autoComplete="off"
                        placeholder={t('providersSettings.apiKey.placeholder')}
                        spellCheck={false}
                        type={customShowApiKey ? 'text' : 'password'}
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                      />
                      <button
                        className="absolute right-2 bg-none border-none cursor-pointer text-muted p-0.5 flex items-center hover:text-text"
                        title={customShowApiKey ? t('providersSettings.apiKey.hideKey') : t('providersSettings.apiKey.showKey')}
                        type="button"
                        onClick={() => setCustomShowApiKey((v) => !v)}
                      >
                        {customShowApiKey ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-none border-t border-border m-0" />

            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('providersSettings.modelName.eyebrow')}</span>
              </div>
              <input
                className="w-full box-border bg-input-surface border border-border rounded-lg py-[7px] px-3 text-sm text-text outline-none focus:border-accent focus:outline-2 focus:outline-[rgba(111,140,149,0.28)] focus:outline-offset-0 placeholder:text-muted"
                placeholder={t('providersSettings.modelName.placeholder')}
                spellCheck={false}
                type="text"
                value={customModelName}
                onChange={(e) => setCustomModelName(e.target.value)}
              />
            </div>

            {customError && <div className="providers-fetch-error providers-custom-error">{customError}</div>}

            <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                {selectedCustomId !== NEW_CUSTOM_SENTINEL && !customIsActive && (
                  <button
                    className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px"
                    type="button"
                    onClick={() => props.onSetActiveLlmProviderProfile(selectedCustomId!)}
                  >
                    {t('providersSettings.actions.setActive')}
                  </button>
                )}
                {selectedCustomId !== NEW_CUSTOM_SENTINEL && (
                  <button className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px !text-[#e74c3c] hover:!bg-[rgba(231,76,60,0.08)]" type="button" onClick={handleDeleteCustom}>
                    {t('providersSettings.actions.delete')}
                  </button>
                )}
              </div>
              <button className="bg-accent text-white border-none rounded-lg py-[7px] px-[18px] text-sm font-medium cursor-pointer transition-opacity duration-150 hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed" type="button" onClick={handleSaveCustom}>
                {selectedCustomId === NEW_CUSTOM_SENTINEL ? t('providersSettings.actions.addProvider') : t('providersSettings.actions.saveChanges')}
              </button>
            </div>
          </div>
        ) : (
          selectedProvider && (
            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-semibold m-0">{selectedProvider.label}</h2>
                  <span className={`inline-flex items-center justify-center min-h-6 py-[3px] px-2 rounded-full text-xs font-bold ${isProviderSelected ? 'bg-[rgba(44,106,70,0.16)] text-ok' : 'bg-accent-cold-soft text-accent-cold'}`}>
                    {isProviderSelected ? t('providersSettings.status.active') : enabledCount > 0 ? t('providersSettings.status.model', { count: enabledCount }) : t('providersSettings.notConfigured')}
                  </span>
                </div>
                <p className="text-muted text-[13px] mt-1 max-w-[56ch]">{selectedProvider.description}</p>
              </div>

              <hr className="border-none border-t border-border m-0" />

              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('providersSettings.apiKey.eyebrow')}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-1 items-center relative">
                    {inStoredKeyMode ? (
                      <>
                        <input
                          readOnly
                          spellCheck={false}
                          type="text"
                          value={showStoredKey ? (storedKeyValue ?? '...............') : '...............'}
                          title={t('providersSettings.apiKey.replaceTitle')}
                          style={{ cursor: 'pointer', letterSpacing: showStoredKey ? undefined : '0.1em' }}
                          onClick={() => { setIsEditingKey(true); setShowStoredKey(false); setStoredKeyValue(null) }}
                        />
                        <button
                          className="absolute right-2 bg-none border-none cursor-pointer text-muted p-0.5 flex items-center hover:text-text"
                          title={showStoredKey ? t('providersSettings.apiKey.hideKey') : t('providersSettings.apiKey.showKey')}
                          type="button"
                          onClick={() => { void handleToggleStoredKey() }}
                        >
                          {showStoredKey ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          autoComplete="off"
                          placeholder={t('providersSettings.apiKey.placeholder')}
                          spellCheck={false}
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                        />
                        <button
                          className="absolute right-2 bg-none border-none cursor-pointer text-muted p-0.5 flex items-center hover:text-text"
                          title={showApiKey ? t('providersSettings.apiKey.hideKey') : t('providersSettings.apiKey.showKey')}
                          type="button"
                          onClick={() => setShowApiKey((v) => !v)}
                        >
                          {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </>
                    )}
                  </div>
                  {apiKeyLink && (
                    <a className="text-xs whitespace-nowrap text-accent no-underline hover:underline" href={apiKeyLink} rel="noreferrer" target="_blank">
                      {t('providersSettings.apiKey.getKey')}
                    </a>
                  )}
                </div>
              </div>

              <hr className="border-none border-t border-border m-0" />

              <div className="providers-form-section providers-models-section">
                <div className="flex items-start justify-between gap-3">
                  <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('providersSettings.models.eyebrow')}</span>
                  <button className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px" disabled={isFetching} type="button" onClick={handleFetch}>
                    {isFetching ? t('providersSettings.models.fetching') : t('providersSettings.models.fetchModels')}
                  </button>
                </div>

                {fetchError && <div className="text-[#e74c3c] text-xs mb-2">{fetchError}</div>}

                {sortedModels.length > 0 && (
                  <>
                    {fetchedModels.length > 0 && (
                      <label className="providers-search-field providers-model-search">
                        <SearchIcon />
                        <input
                          placeholder={t('providersSettings.models.searchPlaceholder')}
                          type="search"
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                        />
                      </label>
                    )}
                    <div className="text-[11px] text-muted mb-2">
                      {t('providersSettings.models.showing', { count: shownCount, enabled: enabledCount })}
                    </div>
                    <div className="flex flex-col gap-0.5 max-h-80 overflow-y-auto">
                      {sortedModels.map((model) => {
                        const existingProfile = providerProfiles.find((p) => p.modelName === model.modelId)
                        const isEnabled = Boolean(existingProfile)
                        const isToggling = togglingModelId === model.modelId
                        return (
                          <div className="flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-row-hover-surface" key={model.modelId}>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-medium">{model.modelId}</span>
                              {model.ownedBy && (
                                <span className="text-[11px] text-muted">{model.ownedBy}</span>
                              )}
                            </div>
                            <label className={`relative inline-block w-9 h-5 shrink-0 ${isToggling ? 'opacity-60 pointer-events-none' : ''}`}>
                              <input
                                checked={isEnabled}
                                disabled={isToggling}
                                type="checkbox"
                                className="opacity-0 w-0 h-0 absolute peer"
                                onChange={() => { void handleModelToggle(model) }}
                              />
                              <span className="absolute cursor-pointer inset-0 bg-border rounded-[10px] transition-[background] duration-150 peer-checked:bg-accent before:content-[''] before:absolute before:h-3.5 before:w-3.5 before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform before:duration-150 peer-checked:before:translate-x-4" />
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {!isFetching && sortedModels.length === 0 && (
                  <div className="text-muted text-[13px] py-4 text-center">
                    {referenceProfileId
                      ? t('providersSettings.models.fetchHintHasKey')
                      : t('providersSettings.models.fetchHintNoKey')}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
