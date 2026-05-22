import { useEffect, useRef, useState } from 'react'

import { TARGET_LANGUAGE_OPTIONS, type ApiStatus, type AppConfig, type AppSettingsUpdate, type LlmProviderState } from '../../../shared/types'

interface GeneralSettingsPageProps {
  config: AppConfig
  apiStatus: ApiStatus
  llmProviderState: LlmProviderState
  onCancelQueuedTranslations: () => void
  onOpenLlmDebugFolder: () => void
  onSaveSettings: (update: AppSettingsUpdate) => void
  onSetActiveLlmProviderProfile: (profileId: string) => void
}

export function GeneralSettingsPage(props: GeneralSettingsPageProps) {
  const [formState, setFormState] = useState(() => createFormState(props.config))
  const targetLanguageRef = useRef<HTMLSelectElement | null>(null)
  const hasAppliedFocus = useRef(false)

  useEffect(() => {
    setFormState(createFormState(props.config))
  }, [props.config])

  useEffect(() => {
    if (hasAppliedFocus.current) {
      return
    }

    targetLanguageRef.current?.focus()
    hasAppliedFocus.current = true
  }, [])

  return (
    <div className="settings-page-stack">
      <div className="settings-note-grid">
        <div className="settings-note">
          <span className="settings-note-label">Queue snapshot</span>
          <strong>{props.apiStatus.queueLength} waiting</strong>
          <span className="settings-field-hint">{props.apiStatus.activeJobs} active batches</span>
        </div>
        <div className="settings-note">
          <span className="settings-note-label">Provider coverage</span>
          <strong>{props.llmProviderState.profiles.length} saved profile{props.llmProviderState.profiles.length === 1 ? '' : 's'}</strong>
          <span className="settings-field-hint">
            {props.llmProviderState.activeProfileId ? 'One provider profile is active for live translation.' : 'No active provider profile yet.'}
          </span>
        </div>
      </div>

      <div className="settings-grid">
        <label className="settings-field">
          <span className="settings-field-label">Active translation model</span>
          <select
            value={props.llmProviderState.activeProfileId ?? ''}
            onChange={(event) => {
              if (event.target.value) props.onSetActiveLlmProviderProfile(event.target.value)
            }}
          >
            {props.llmProviderState.profiles.length === 0 ? (
              <option value="">No models configured</option>
            ) : (
              props.llmProviderState.profiles.map((profile) => (
                <option key={profile.profileId} value={profile.profileId}>
                  {profile.customLabel ?? profile.providerId} / {profile.modelName}
                </option>
              ))
            )}
          </select>
          <span className="settings-field-hint">The model used for live translation. Configure models in the Providers tab.</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Target language</span>
          <select
            ref={targetLanguageRef}
            value={formState.targetLanguage}
            onChange={(event) => setFormState((current) => ({ ...current, targetLanguage: event.target.value as AppConfig['targetLanguage'] }))}
          >
            {TARGET_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="settings-field-hint">Choose the language used for every translated chat line.</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Debounce ms</span>
          <input
            type="number"
            value={formState.debounceMs}
            onChange={(event) => setFormState((current) => ({ ...current, debounceMs: event.target.value }))}
          />
          <span className="settings-field-hint">Delay before a new batch is queued for translation.</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Max queue size</span>
          <input
            type="number"
            value={formState.maxQueueSize}
            onChange={(event) => setFormState((current) => ({ ...current, maxQueueSize: event.target.value }))}
          />
          <span className="settings-field-hint">Prevents backlog growth when many channels are active.</span>
        </label>

        <label className="settings-field settings-toggle-field">
          <span className="settings-field-label">Enable LLM debugger</span>
          <span className="settings-field-hint">
            Save every LLM request payload and raw response into separate JSON files under the app data `llm-debug` folder.
          </span>
          <div className="settings-checkbox-row">
            <input
              checked={formState.llmDebugEnabled}
              onChange={(event) => setFormState((current) => ({ ...current, llmDebugEnabled: event.target.checked }))}
              type="checkbox"
            />
            <span>{formState.llmDebugEnabled ? 'Debugger enabled' : 'Debugger disabled'}</span>
          </div>
        </label>

        <label className="settings-field settings-field-wide">
          <span className="settings-field-label">Translation prompt</span>
          <textarea
            rows={5}
            value={formState.translationPrompt}
            onChange={(event) => setFormState((current) => ({ ...current, translationPrompt: event.target.value }))}
            placeholder="Use {{targetLanguage}} to inject the selected target language."
          />
          <span className="settings-field-hint">Use <code>{'{{targetLanguage}}'}</code> anywhere in the prompt to bind the selected language.</span>
        </label>
      </div>

      <div className="settings-action-row">
        <button className="ghost-button" type="button" onClick={props.onOpenLlmDebugFolder}>
          Open debug folder
        </button>
        <button
          className="ghost-button"
          type="button"
          disabled={props.apiStatus.queueLength === 0}
          onClick={props.onCancelQueuedTranslations}
        >
          Cancel queued translations
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            props.onSaveSettings({
              config: {
                llmDebugEnabled: formState.llmDebugEnabled,
                targetLanguage: formState.targetLanguage,
                translationPrompt: formState.translationPrompt,
                debounceMs: Number(formState.debounceMs),
                maxQueueSize: Number(formState.maxQueueSize)
              }
            })
          }}
        >
          Save general settings
        </button>
      </div>
    </div>
  )
}

function createFormState(config: AppConfig) {
  return {
    llmDebugEnabled: config.llmDebugEnabled,
    targetLanguage: config.targetLanguage,
    translationPrompt: config.translationPrompt,
    debounceMs: String(config.debounceMs),
    maxQueueSize: String(config.maxQueueSize)
  }
}