import { useEffect, useState } from 'react'

import type { ApiStatus, AppConfig } from '../../shared/types'

interface SettingsPanelProps {
  config: AppConfig
  apiStatus: ApiStatus
  forceLlmSetup?: boolean
  onSave: (update: { config: Partial<AppConfig>; apiKey?: string }) => void
}

export function SettingsPanel(props: SettingsPanelProps) {
  const [formState, setFormState] = useState(() => createFormState(props.config))

  useEffect(() => {
    setFormState((current) => ({
      ...createFormState(props.config),
      apiKey: current.apiKey
    }))
  }, [props.config])

  const requiresLlmFields = props.forceLlmSetup === true
  const canSubmitLlmConfig =
    formState.apiBaseUrl.trim().length > 0 && formState.modelName.trim().length > 0 && formState.apiKey.trim().length > 0

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
      <div className="settings-grid">
        {!requiresLlmFields ? (
          <label>
            <span>Target language</span>
            <input
              value={formState.targetLanguage}
              onChange={(event) => setFormState((current) => ({ ...current, targetLanguage: event.target.value }))}
            />
          </label>
        ) : null}
        <label>
          <span>API base URL</span>
          <input
            value={formState.apiBaseUrl}
            onChange={(event) => setFormState((current) => ({ ...current, apiBaseUrl: event.target.value }))}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label>
          <span>Model name</span>
          <input
            value={formState.modelName}
            onChange={(event) => setFormState((current) => ({ ...current, modelName: event.target.value }))}
            placeholder="gpt-4.1-mini"
          />
        </label>
        {!requiresLlmFields ? (
          <label>
            <span>Debounce ms</span>
            <input
              type="number"
              value={formState.debounceMs}
              onChange={(event) => setFormState((current) => ({ ...current, debounceMs: event.target.value }))}
            />
          </label>
        ) : null}
        {!requiresLlmFields ? (
          <label>
            <span>Max queue size</span>
            <input
              type="number"
              value={formState.maxQueueSize}
              onChange={(event) => setFormState((current) => ({ ...current, maxQueueSize: event.target.value }))}
            />
          </label>
        ) : null}
        <label>
          <span>API key</span>
          <input
            type="password"
            value={formState.apiKey}
            onChange={(event) => setFormState((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder={props.apiStatus.configured ? 'Leave blank to keep the current key' : 'Required'}
          />
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