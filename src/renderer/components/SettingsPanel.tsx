import { useEffect, useRef, useState } from 'react'

import type { ApiStatus, AppConfig } from '../../shared/types'

interface SettingsPanelProps {
  config: AppConfig
  apiStatus: ApiStatus
  forceLlmSetup?: boolean
  onSave: (update: { config: Partial<AppConfig>; apiKey?: string }) => void
}

export function SettingsPanel(props: SettingsPanelProps) {
  const [formState, setFormState] = useState(() => createFormState(props.config))
  const targetLanguageRef = useRef<HTMLInputElement | null>(null)
  const apiBaseUrlRef = useRef<HTMLInputElement | null>(null)
  const hasAppliedInitialFocus = useRef(false)

  useEffect(() => {
    setFormState((current) => ({
      ...createFormState(props.config),
      apiKey: current.apiKey
    }))
  }, [props.config])

  const requiresLlmFields = props.forceLlmSetup === true
  const canSubmitLlmConfig =
    formState.apiBaseUrl.trim().length > 0 && formState.modelName.trim().length > 0 && formState.apiKey.trim().length > 0

  useEffect(() => {
    if (hasAppliedInitialFocus.current) {
      return
    }

    const target = requiresLlmFields ? apiBaseUrlRef.current : targetLanguageRef.current ?? apiBaseUrlRef.current
    target?.focus()
    hasAppliedInitialFocus.current = true
  }, [requiresLlmFields])

  return (
    <section className={`panel settings-panel ${props.forceLlmSetup ? 'panel-hero' : ''}`}>
      <div className="panel-header">
        <div>
          <div className="eyebrow">Settings</div>
          <h2>{props.forceLlmSetup ? 'Configure translation provider' : 'Translation pipeline'}</h2>
        </div>
        <span className={`chip ${props.apiStatus.configured ? 'chip-ok' : 'chip-warn'}`}>
          {props.apiStatus.configured ? 'configured' : 'not configured'}
        </span>
      </div>
      {props.forceLlmSetup ? (
        <p className="hero-copy">
          Fill in a single OpenAI-compatible provider profile before the app starts translating chat. The values are stored in the local SQLite configuration database.
        </p>
      ) : null}
      <div className="settings-note-grid">
        <div className="settings-note">
          <span className="settings-note-label">Queue snapshot</span>
          <strong>{props.apiStatus.queueLength} waiting</strong>
        </div>
        <div className="settings-note">
          <span className="settings-note-label">Provider state</span>
          <strong>{props.apiStatus.configured ? 'Configured' : 'Needs credentials'}</strong>
        </div>
      </div>
      <div className="settings-grid">
        {!requiresLlmFields ? (
          <label className="settings-field">
            <span className="settings-field-label">Target language</span>
            <input
              ref={targetLanguageRef}
              value={formState.targetLanguage}
              onChange={(event) => setFormState((current) => ({ ...current, targetLanguage: event.target.value }))}
            />
            <span className="settings-field-hint">Use a locale tag such as zh-CN or en-US.</span>
          </label>
        ) : null}
        <label className="settings-field">
          <span className="settings-field-label">API base URL</span>
          <input
            ref={apiBaseUrlRef}
            value={formState.apiBaseUrl}
            onChange={(event) => setFormState((current) => ({ ...current, apiBaseUrl: event.target.value }))}
            placeholder="https://api.openai.com/v1"
          />
          <span className="settings-field-hint">Point this at any OpenAI-compatible endpoint.</span>
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Model name</span>
          <input
            value={formState.modelName}
            onChange={(event) => setFormState((current) => ({ ...current, modelName: event.target.value }))}
            placeholder="gpt-4.1-mini"
          />
          <span className="settings-field-hint">Keep it aligned with the provider capabilities.</span>
        </label>
        {!requiresLlmFields ? (
          <label className="settings-field">
            <span className="settings-field-label">Debounce ms</span>
            <input
              type="number"
              value={formState.debounceMs}
              onChange={(event) => setFormState((current) => ({ ...current, debounceMs: event.target.value }))}
            />
            <span className="settings-field-hint">Delay before a new batch is queued for translation.</span>
          </label>
        ) : null}
        {!requiresLlmFields ? (
          <label className="settings-field">
            <span className="settings-field-label">Max queue size</span>
            <input
              type="number"
              value={formState.maxQueueSize}
              onChange={(event) => setFormState((current) => ({ ...current, maxQueueSize: event.target.value }))}
            />
            <span className="settings-field-hint">Prevents backlog growth when many channels are active.</span>
          </label>
        ) : null}
        <label className="settings-field settings-field-wide">
          <span className="settings-field-label">API key</span>
          <input
            type="password"
            value={formState.apiKey}
            onChange={(event) => setFormState((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder={props.apiStatus.configured ? 'Leave blank to keep the current key' : 'Required'}
          />
          <span className="settings-field-hint">
            {props.apiStatus.configured ? 'Leave empty to preserve the stored key.' : 'Stored locally and only used from the main process.'}
          </span>
        </label>
      </div>
      <button
        className="primary-button"
        type="button"
        disabled={requiresLlmFields && !canSubmitLlmConfig}
        onClick={() => {
          props.onSave({
            config: props.forceLlmSetup
              ? {
                  apiBaseUrl: formState.apiBaseUrl.trim(),
                  modelName: formState.modelName.trim()
                }
              : {
                  targetLanguage: formState.targetLanguage,
                  apiBaseUrl: formState.apiBaseUrl.trim(),
                  modelName: formState.modelName.trim(),
                  debounceMs: Number(formState.debounceMs),
                  maxQueueSize: Number(formState.maxQueueSize)
                },
            apiKey: formState.apiKey || undefined
          })
          setFormState((current) => ({ ...current, apiKey: '' }))
        }}
      >
        {props.forceLlmSetup ? 'Save provider settings' : 'Save settings'}
      </button>
    </section>
  )
}

function createFormState(config: AppConfig) {
  return {
    targetLanguage: config.targetLanguage,
    apiBaseUrl: config.apiBaseUrl,
    modelName: config.modelName,
    debounceMs: String(config.debounceMs),
    maxQueueSize: String(config.maxQueueSize),
    apiKey: ''
  }
}