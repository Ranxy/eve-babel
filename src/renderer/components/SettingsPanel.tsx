import { type ReactNode, useEffect, useState } from 'react'

import type {
  ApiStatus,
  AppConfig,
  AppSettingsUpdate,
  FetchLlmProviderModelsInput,
  LlmProviderModel,
  LlmProviderState,
  SaveLlmProviderProfileInput
} from '../../shared/types'
import { GeneralSettingsPage } from './settings/GeneralSettingsPage'
import { ProvidersSettingsPage } from './settings/ProvidersSettingsPage'

type SettingsSection = 'general' | 'providers'

interface SettingsPanelProps {
  config: AppConfig
  apiStatus: ApiStatus
  llmProviderState: LlmProviderState
  forceLlmSetup?: boolean
  onCancelQueuedTranslations: () => void
  onOpenLlmDebugFolder: () => void
  onSaveSettings: (update: AppSettingsUpdate) => void
  onSaveLlmProviderProfile: (input: SaveLlmProviderProfileInput) => void
  onSetActiveLlmProviderProfile: (profileId: string) => void
  onFetchLlmProviderModels: (input: FetchLlmProviderModelsInput) => Promise<LlmProviderModel[]>
}

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string; icon: ReactNode }> = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <line x1="2" y1="5" x2="13" y2="5" />
        <circle cx="10" cy="5" r="1.6" fill="currentColor" stroke="none" />
        <line x1="2" y1="10" x2="13" y2="10" />
        <circle cx="5" cy="10" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    )
  },
  {
    id: 'providers',
    label: 'Providers',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" />
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" />
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" />
      </svg>
    )
  }
]

export function SettingsPanel(props: SettingsPanelProps) {
  const [selectedSection, setSelectedSection] = useState<SettingsSection>('providers')

  useEffect(() => {
    if (props.forceLlmSetup) {
      setSelectedSection('providers')
    }
  }, [props.forceLlmSetup])

  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <nav className="settings-sidebar-nav" aria-label="Settings sections">
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
            onSetActiveLlmProviderProfile={props.onSetActiveLlmProviderProfile}
          />
        ) : (
          <GeneralSettingsPage
            apiStatus={props.apiStatus}
            config={props.config}
            llmProviderState={props.llmProviderState}
            onCancelQueuedTranslations={props.onCancelQueuedTranslations}
            onOpenLlmDebugFolder={props.onOpenLlmDebugFolder}
            onSaveSettings={props.onSaveSettings}
          />
        )}
      </div>

      <footer className="settings-footer">
        <span className="settings-footer-status">All changes saved</span>
        <div className="settings-footer-actions">
          <button className="ghost-button" onClick={() => window.close()} type="button">
            Close
          </button>
          <button className="primary-button" disabled type="button">
            Save
          </button>
        </div>
      </footer>
    </div>
  )
}