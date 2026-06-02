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
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <nav className="settings-sidebar-nav" aria-label={t('settingsPanel.ariaLabel')}>
          {SETTINGS_SECTIONS.map((section) => (
            <button
              className={`settings-sidebar-item ${selectedSection === section.id ? 'active' : ''}`}
              key={section.id}
              onClick={() => setSelectedSection(section.id)}
              type="button"
            >
              <span className="settings-sidebar-icon">{section.icon}</span>
              <span className="settings-sidebar-label">{section.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="settings-body">
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

      <footer className="settings-footer">
        <span className="settings-footer-status">{t('settingsPanel.footer.allSaved')}</span>
        <div className="settings-footer-actions">
          <button className="ghost-button" onClick={() => window.close()} type="button">
            {t('settingsPanel.footer.close')}
          </button>
          <button className="primary-button" disabled type="button">
            {t('settingsPanel.footer.save')}
          </button>
        </div>
      </footer>
    </div>
  )
}