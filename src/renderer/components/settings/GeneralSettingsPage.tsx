import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
          <span className="settings-note-label">{t('generalSettings.queueSnapshot.label')}</span>
          <strong>{t('generalSettings.queueSnapshot.waiting', { count: props.apiStatus.queueLength })}</strong>
          <span className="settings-field-hint">{t('generalSettings.queueSnapshot.activeBatches', { count: props.apiStatus.activeJobs })}</span>
        </div>
        <div className="settings-note">
          <span className="settings-note-label">{t('generalSettings.providerCoverage.label')}</span>
          <strong>{t('generalSettings.providerCoverage.profiles', { count: props.llmProviderState.profiles.length })}</strong>
          <span className="settings-field-hint">
            {props.llmProviderState.activeProfileId ? t('generalSettings.providerCoverage.activeHint') : t('generalSettings.providerCoverage.noActiveHint')}
          </span>
        </div>
      </div>

      <div className="settings-grid">
        <label className="settings-field">
          <span className="settings-field-label">{t('generalSettings.activeModel.label')}</span>
          <select
            value={props.llmProviderState.activeProfileId ?? ''}
            onChange={(event) => {
              if (event.target.value) props.onSetActiveLlmProviderProfile(event.target.value)
            }}
          >
            {props.llmProviderState.profiles.length === 0 ? (
              <option value="">{t('generalSettings.activeModel.noModels')}</option>
            ) : (
              props.llmProviderState.profiles.map((profile) => (
                <option key={profile.profileId} value={profile.profileId}>
                  {profile.customLabel ?? profile.providerId} / {profile.modelName}
                </option>
              ))
            )}
          </select>
          <span className="settings-field-hint">{t('generalSettings.activeModel.hint')}</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">{t('generalSettings.targetLanguage.label')}</span>
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
          <span className="settings-field-hint">{t('generalSettings.targetLanguage.hint')}</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">{t('generalSettings.debounceMs.label')}</span>
          <input
            type="number"
            value={formState.debounceMs}
            onChange={(event) => setFormState((current) => ({ ...current, debounceMs: event.target.value }))}
          />
          <span className="settings-field-hint">{t('generalSettings.debounceMs.hint')}</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">{t('generalSettings.maxQueueSize.label')}</span>
          <input
            type="number"
            value={formState.maxQueueSize}
            onChange={(event) => setFormState((current) => ({ ...current, maxQueueSize: event.target.value }))}
          />
          <span className="settings-field-hint">{t('generalSettings.maxQueueSize.hint')}</span>
        </label>

        <label className="settings-field settings-toggle-field">
          <span className="settings-field-label">{t('generalSettings.llmDebugger.label')}</span>
          <span className="settings-field-hint">
            {t('generalSettings.llmDebugger.hint')}
          </span>
          <div className="settings-checkbox-row">
            <input
              checked={formState.llmDebugEnabled}
              onChange={(event) => setFormState((current) => ({ ...current, llmDebugEnabled: event.target.checked }))}
              type="checkbox"
            />
            <span>{formState.llmDebugEnabled ? t('generalSettings.llmDebugger.enabled') : t('generalSettings.llmDebugger.disabled')}</span>
          </div>
        </label>

        <label className="settings-field settings-field-wide">
          <span className="settings-field-label">{t('generalSettings.translationPrompt.label')}</span>
          <textarea
            rows={5}
            value={formState.translationPrompt}
            onChange={(event) => setFormState((current) => ({ ...current, translationPrompt: event.target.value }))}
            placeholder={t('generalSettings.translationPrompt.placeholder')}
          />
          <span className="settings-field-hint">{t('generalSettings.translationPrompt.hint')}</span>
        </label>
      </div>

      <div className="settings-action-row">
        <button className="ghost-button" type="button" onClick={props.onOpenLlmDebugFolder}>
          {t('generalSettings.actions.openDebugFolder')}
        </button>
        <button
          className="ghost-button"
          type="button"
          disabled={props.apiStatus.queueLength === 0}
          onClick={props.onCancelQueuedTranslations}
        >
          {t('generalSettings.actions.cancelTranslations')}
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
          {t('generalSettings.actions.save')}
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