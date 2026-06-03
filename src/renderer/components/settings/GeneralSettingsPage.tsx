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
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-settings-note-surface border border-border grid gap-1.5">
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('generalSettings.queueSnapshot.label')}</span>
          <strong>{t('generalSettings.queueSnapshot.waiting', { count: props.apiStatus.queueLength })}</strong>
          <span className="text-muted text-sm">{t('generalSettings.queueSnapshot.activeBatches', { count: props.apiStatus.activeJobs })}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-settings-note-surface border border-border grid gap-1.5">
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('generalSettings.providerCoverage.label')}</span>
          <strong>{t('generalSettings.providerCoverage.profiles', { count: props.llmProviderState.profiles.length })}</strong>
          <span className="text-muted text-sm">
            {props.llmProviderState.activeProfileId ? t('generalSettings.providerCoverage.activeHint') : t('generalSettings.providerCoverage.noActiveHint')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="p-3.5 rounded-2xl bg-settings-field-surface border border-border grid gap-2">
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('generalSettings.activeModel.label')}</span>
          <select
            className="border border-border rounded-lg py-3 px-3.5 bg-input-surface w-full max-w-full box-border focus:outline-2 focus:outline-[rgba(111,140,149,0.24)] focus:outline-offset-0"
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
          <span className="text-muted text-sm">{t('generalSettings.activeModel.hint')}</span>
        </label>

        <label className="p-3.5 rounded-2xl bg-settings-field-surface border border-border grid gap-2">
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('generalSettings.targetLanguage.label')}</span>
          <select
            ref={targetLanguageRef}
            className="border border-border rounded-lg py-3 px-3.5 bg-input-surface w-full max-w-full box-border focus:outline-2 focus:outline-[rgba(111,140,149,0.24)] focus:outline-offset-0"
            value={formState.targetLanguage}
            onChange={(event) => setFormState((current) => ({ ...current, targetLanguage: event.target.value as AppConfig['targetLanguage'] }))}
          >
            {TARGET_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-muted text-sm">{t('generalSettings.targetLanguage.hint')}</span>
        </label>

        <label className="p-3.5 rounded-2xl bg-settings-field-surface border border-border grid gap-2">
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('generalSettings.debounceMs.label')}</span>
          <input
            type="number"
            className="border border-border rounded-lg py-3 px-3.5 bg-input-surface w-full max-w-full box-border focus:outline-2 focus:outline-[rgba(111,140,149,0.24)] focus:outline-offset-0"
            value={formState.debounceMs}
            onChange={(event) => setFormState((current) => ({ ...current, debounceMs: event.target.value }))}
          />
          <span className="text-muted text-sm">{t('generalSettings.debounceMs.hint')}</span>
        </label>

        <label className="p-3.5 rounded-2xl bg-settings-field-surface border border-border grid gap-2">
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('generalSettings.maxQueueSize.label')}</span>
          <input
            type="number"
            className="border border-border rounded-lg py-3 px-3.5 bg-input-surface w-full max-w-full box-border focus:outline-2 focus:outline-[rgba(111,140,149,0.24)] focus:outline-offset-0"
            value={formState.maxQueueSize}
            onChange={(event) => setFormState((current) => ({ ...current, maxQueueSize: event.target.value }))}
          />
          <span className="text-muted text-sm">{t('generalSettings.maxQueueSize.hint')}</span>
        </label>

        <label className="p-3.5 rounded-2xl bg-settings-field-surface border border-border grid gap-2 content-start">
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('generalSettings.llmDebugger.label')}</span>
          <span className="text-muted text-sm">
            {t('generalSettings.llmDebugger.hint')}
          </span>
          <div className="flex items-center gap-2.5 min-h-11">
            <input
              className="size-[18px] [accent-color:var(--accent)]"
              checked={formState.llmDebugEnabled}
              onChange={(event) => setFormState((current) => ({ ...current, llmDebugEnabled: event.target.checked }))}
              type="checkbox"
            />
            <span>{formState.llmDebugEnabled ? t('generalSettings.llmDebugger.enabled') : t('generalSettings.llmDebugger.disabled')}</span>
          </div>
        </label>

        <label className="p-3.5 rounded-2xl bg-settings-field-surface border border-border grid gap-2 [grid-column:1/-1]">
          <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('generalSettings.translationPrompt.label')}</span>
          <textarea
            rows={5}
            className="border border-border rounded-lg py-3 px-3.5 bg-input-surface w-full max-w-full box-border min-h-[132px] resize-y focus:outline-2 focus:outline-[rgba(111,140,149,0.24)] focus:outline-offset-0"
            value={formState.translationPrompt}
            onChange={(event) => setFormState((current) => ({ ...current, translationPrompt: event.target.value }))}
            placeholder={t('generalSettings.translationPrompt.placeholder')}
          />
          <span className="text-muted text-sm">{t('generalSettings.translationPrompt.hint')}</span>
        </label>
      </div>

      <div className="flex justify-end gap-2.5 flex-wrap">
        <button className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px" type="button" onClick={props.onOpenLlmDebugFolder}>
          {t('generalSettings.actions.openDebugFolder')}
        </button>
        <button
          className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px"
          type="button"
          disabled={props.apiStatus.queueLength === 0}
          onClick={props.onCancelQueuedTranslations}
        >
          {t('generalSettings.actions.cancelTranslations')}
        </button>
        <button
          className="rounded-full py-2 px-3.5 border border-transparent bg-primary-button-surface text-primary-button-text font-bold active:translate-y-px disabled:opacity-50"
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
