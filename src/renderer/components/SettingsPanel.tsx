import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  ApiStatus,
  AppConfig,
  AppSettingsUpdate,
  FetchLlmProviderModelsInput,
  GlossaryEntry,
  LlmProviderModel,
  LlmProviderState,
  SaveLlmProviderProfileInput
} from '../../shared/types'
import { GeneralSettingsPage } from './settings/GeneralSettingsPage'
import { ProvidersSettingsPage } from './settings/ProvidersSettingsPage'
import { TerminologySettingsPage } from './settings/TerminologySettingsPage'

type SettingsSection = 'general' | 'providers' | 'terminology'

interface SettingsSectionDef {
  id: SettingsSection
  label: string
  icon: ReactNode
}

interface SettingsPanelProps {
  config: AppConfig
  apiStatus: ApiStatus
  llmProviderState: LlmProviderState
  forceLlmSetup?: boolean
  onCancelQueuedTranslations: () => void
  onOpenLlmDebugFolder: () => void
  onSaveSettings: (update: AppSettingsUpdate) => void
  onSaveLlmProviderProfile: (input: SaveLlmProviderProfileInput) => void
  onDeleteLlmProviderProfile: (profileId: string) => void
  onSetActiveLlmProviderProfile: (profileId: string) => void
  onFetchLlmProviderModels: (input: FetchLlmProviderModelsInput) => Promise<LlmProviderModel[]>
  onAddGlossaryEntry: (entry: { notes?: string; terms: Record<string, string[]> }) => void
  onUpdateGlossaryEntry: (entry: GlossaryEntry) => void
  onDeleteGlossaryEntry: (id: string) => void
}

const SECTION_ICONS: Record<SettingsSection, ReactNode> = {
  general: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="2" y1="5" x2="13" y2="5" />
      <circle cx="10" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <line x1="2" y1="10" x2="13" y2="10" />
      <circle cx="5" cy="10" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  providers: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" />
    </svg>
  ),
  terminology: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.8" y="0.8" width="11.4" height="13.4" rx="1.5" />
      <line x1="5" y1="4" x2="10" y2="4" />
      <line x1="5" y1="7" x2="10" y2="7" />
      <line x1="5" y1="10" x2="8" y2="10" />
    </svg>
  ),
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { t } = useTranslation()
  const [selectedSection, setSelectedSection] = useState<SettingsSection>('providers')

  const SETTINGS_SECTIONS: SettingsSectionDef[] = [
    { id: 'general', label: t('settingsPanel.sections.general'), icon: SECTION_ICONS.general },
    { id: 'providers', label: t('settingsPanel.sections.providers'), icon: SECTION_ICONS.providers },
    { id: 'terminology', label: t('settingsPanel.sections.terminology'), icon: SECTION_ICONS.terminology },
  ]

  useEffect(() => {
    if (props.forceLlmSetup) {
      setSelectedSection('providers')
    }
  }, [props.forceLlmSetup])

  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] flex-1 min-h-0 border border-border bg-panel-surface rounded-3xl backdrop-blur-[18px] overflow-hidden">
      <aside className="[grid-column:1] [grid-row:1/3] border-r border-border py-4 px-2.5 bg-[rgba(246,248,251,0.6)] dark:bg-[rgba(18,26,36,0.6)]">
        <nav className="flex flex-col gap-1" aria-label={t('settingsPanel.ariaLabel')}>
          {SETTINGS_SECTIONS.map((section) => {
            const isActive = selectedSection === section.id
            return (
              <button
                className={`flex items-center gap-2.5 w-full py-[9px] px-3 border border-transparent rounded-lg bg-transparent text-inherit text-left cursor-pointer hover:bg-row-hover-surface ${
                  isActive ? 'bg-row-hover-surface border-[rgba(111,140,149,0.22)]' : ''
                }`}
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                type="button"
              >
                <span className={`flex items-center justify-center w-5 flex-none ${isActive ? 'text-accent-cold' : 'text-muted'}`}>{section.icon}</span>
                <span className="text-sm font-medium">{section.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="[grid-column:2] [grid-row:1] py-4 px-5 flex flex-col gap-4 min-h-0">
        {selectedSection === 'providers' ? (
          <ProvidersSettingsPage
            apiStatus={props.apiStatus}
            forceLlmSetup={props.forceLlmSetup}
            llmProviderState={props.llmProviderState}
            onFetchLlmProviderModels={props.onFetchLlmProviderModels}
            onSaveLlmProviderProfile={props.onSaveLlmProviderProfile}
            onDeleteLlmProviderProfile={props.onDeleteLlmProviderProfile}
            onSetActiveLlmProviderProfile={props.onSetActiveLlmProviderProfile}
          />
        ) : selectedSection === 'general' ? (
          <GeneralSettingsPage
            apiStatus={props.apiStatus}
            config={props.config}
            llmProviderState={props.llmProviderState}
            onCancelQueuedTranslations={props.onCancelQueuedTranslations}
            onOpenLlmDebugFolder={props.onOpenLlmDebugFolder}
            onSaveSettings={props.onSaveSettings}
            onSetActiveLlmProviderProfile={props.onSetActiveLlmProviderProfile}
          />
        ) : (
          <TerminologySettingsPage
            glossary={props.config.glossary}
            targetLanguage={props.config.targetLanguage}
            onAddGlossaryEntry={props.onAddGlossaryEntry}
            onUpdateGlossaryEntry={props.onUpdateGlossaryEntry}
            onDeleteGlossaryEntry={props.onDeleteGlossaryEntry}
          />
        )}
      </div>

      <footer className="[grid-column:2] [grid-row:2] flex justify-between items-center py-2.5 px-5 border-t border-border">
        <span className="text-muted text-sm">{t('settingsPanel.footer.allSaved')}</span>
        <div className="flex gap-2">
          <button className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px" onClick={() => window.close()} type="button">
            {t('settingsPanel.footer.close')}
          </button>
          <button className="rounded-full py-2 px-3.5 border border-transparent bg-primary-button-surface text-primary-button-text font-bold active:translate-y-px disabled:opacity-50" disabled type="button">
            {t('settingsPanel.footer.save')}
          </button>
        </div>
      </footer>
    </div>
  )
}
