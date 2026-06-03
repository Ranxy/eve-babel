import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChannelList } from './components/ChannelList'
import { MessageFeed } from './components/MessageFeed'
import { OverlayHandleView } from './components/OverlayHandleView'
import { OverlayView } from './components/OverlayView'
import { SettingsPanel } from './components/SettingsPanel'
import { StatusBar } from './components/StatusBar'
import { buildChannelStateKey, useAppStore } from './store/appStore'

export function App() {
  const { t } = useTranslation()
  const { state, actions } = useAppStore()
  const [selectedChannelName, setSelectedChannelName] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDockMenuOpen, setIsDockMenuOpen] = useState(false)
  const urlParams = new URLSearchParams(window.location.search)
  const isSettingsWindow = urlParams.get('view') === 'settings'
  const isOverlayBodyWindow = urlParams.get('view') === 'overlay'
  const isOverlayHandleWindow = urlParams.get('view') === 'overlay-handle'
  const overlayChannelName = urlParams.get('channel') ?? ''
  const dockMenuRef = useRef<HTMLDivElement | null>(null)
  const dockMenuCloseTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (state.channels.length === 0) {
      setSelectedChannelName(null)
      return
    }

    const hasCurrentChannel = selectedChannelName ? state.channels.some((channel) => channel.channelName === selectedChannelName) : false
    if (hasCurrentChannel) {
      return
    }

    let nextChannelName: string | null = null

    nextChannelName = state.channels[0]?.channelName ?? null

    setSelectedChannelName(nextChannelName ?? state.channels[0]?.channelName ?? null)
  }, [selectedChannelName, state.channels, state.config.selectedCharacterId])

  useEffect(() => {
    if (!selectedChannelName) {
      return
    }

    void actions.loadChannelMessages(selectedChannelName)
  }, [actions, selectedChannelName, state.config.selectedCharacterId])

  useEffect(() => {
    if (!isDockMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!dockMenuRef.current?.contains(event.target as Node)) {
        setIsDockMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDockMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDockMenuOpen])

  useEffect(() => {
    return () => {
      if (dockMenuCloseTimeoutRef.current !== null) {
        window.clearTimeout(dockMenuCloseTimeoutRef.current)
      }
    }
  }, [])

  const openDockMenu = () => {
    if (dockMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(dockMenuCloseTimeoutRef.current)
      dockMenuCloseTimeoutRef.current = null
    }

    setIsDockMenuOpen(true)
  }

  const scheduleDockMenuClose = () => {
    if (dockMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(dockMenuCloseTimeoutRef.current)
    }

    dockMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsDockMenuOpen(false)
      dockMenuCloseTimeoutRef.current = null
    }, 180)
  }

  if (state.loading && state.characters.length === 0) {
    return <div className="app-shell loading-shell">Loading EVE Babel…</div>
  }

  const showForcedLlmSetup = state.directoryStatus.exists && !state.apiStatus.configured
  const selectedCharacter = state.characters.find((character) => character.characterId === state.config.selectedCharacterId) ?? state.characters[0] ?? null
  const selectedChannelState =
    selectedCharacter && selectedChannelName
      ? state.channelMessages[buildChannelStateKey(selectedCharacter.characterId, selectedChannelName)]
      : undefined

  if (isOverlayHandleWindow && overlayChannelName) {
    return <OverlayHandleView channelName={overlayChannelName} />
  }

  if (isOverlayBodyWindow && overlayChannelName) {
    return <OverlayView channelName={overlayChannelName} />
  }

  if (isSettingsWindow) {
    return (
      <div className="app-shell settings-window-shell">
        <div className="app-backdrop" />
        <main className="app-layout settings-window-layout">
          {state.error ? <div className="error-banner">{state.error}</div> : null}
          <SettingsPanel
            apiStatus={state.apiStatus}
            config={state.config}
            forceLlmSetup={showForcedLlmSetup}
            llmProviderState={state.llmProviderState}
            onCancelQueuedTranslations={actions.cancelQueuedTranslations}
            onFetchLlmProviderModels={actions.fetchLlmProviderModels}
            onOpenLlmDebugFolder={actions.openLlmDebugFolder}
            onSaveLlmProviderProfile={actions.saveLlmProviderProfile}
            onDeleteLlmProviderProfile={actions.deleteLlmProviderProfile}
            onSaveSettings={actions.updateSettings}
            onSetActiveLlmProviderProfile={actions.setActiveLlmProviderProfile}
            onAddGlossaryEntry={actions.addGlossaryEntry}
            onUpdateGlossaryEntry={actions.updateGlossaryEntry}
            onDeleteGlossaryEntry={actions.deleteGlossaryEntry}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell app-shell-main">
      <div className="app-backdrop" />
      <main className="app-layout app-layout-main">
        <StatusBar
          apiStatus={state.apiStatus}
          characters={state.characters}
          isSidebarCollapsed={isSidebarCollapsed}
          selectedCharacterId={state.config.selectedCharacterId}
          targetLanguage={state.config.targetLanguage}
          onSelectCharacter={actions.selectCharacter}
          onSelectTargetLanguage={(targetLanguage) => actions.updateSettings({ config: { targetLanguage } })}
          onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        />

        {state.error ? <div className="error-banner">{state.error}</div> : null}
        <section className="workspace-stage">
          {!state.directoryStatus.exists ? (
            <section className="panel panel-hero workspace-placeholder">
              <div className="eyebrow">{t('app.directorySetup.eyebrow')}</div>
              <h1>{t('app.directorySetup.title')}</h1>
              <p className="hero-copy">{state.directoryStatus.errorMessage}</p>
              <button className="primary-button" onClick={actions.chooseLogDirectory} type="button">
                {t('app.directorySetup.cta')}
              </button>
            </section>
          ) : showForcedLlmSetup ? (
            <section className="panel panel-hero workspace-placeholder">
              <div className="eyebrow">{t('app.providerSetup.eyebrow')}</div>
              <h1>{t('app.providerSetup.title')}</h1>
              <p className="hero-copy">{t('app.providerSetup.description')}</p>
              <button className="primary-button" onClick={actions.openSettingsWindow} type="button">
                {t('app.providerSetup.cta')}
              </button>
            </section>
          ) : state.characters.length === 0 ? (
            <section className="panel panel-hero workspace-placeholder">
              <div className="eyebrow">{t('app.noCharacters.eyebrow')}</div>
              <h1>{t('app.noCharacters.title')}</h1>
              <p className="hero-copy">{t('app.noCharacters.description')}</p>
            </section>
          ) : (
            <div className={`workspace-surface ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
              {!isSidebarCollapsed ? (
                <aside className="panel channel-dock">
                  <ChannelList
                    channels={state.channels}
                    selectedChannelName={selectedChannelName}
                    onSelectChannel={setSelectedChannelName}
                    onToggleChannel={actions.setChannelEnabled}
                    onTogglePinned={actions.setChannelPinned}
                  />
                  <div
                    className="dock-menu-region"
                    onPointerEnter={openDockMenu}
                    onPointerLeave={scheduleDockMenuClose}
                    ref={dockMenuRef}
                  >
                    <button
                      aria-expanded={isDockMenuOpen}
                      aria-haspopup="menu"
                      className="dock-menu-trigger"
                      onClick={() => setIsDockMenuOpen((current) => !current)}
                      onFocus={openDockMenu}
                      type="button"
                    >
                      ...
                    </button>
                    {isDockMenuOpen ? (
                      <div className="dock-menu-popover" role="menu">
                        <button className="dock-menu-item" onClick={actions.openSettingsWindow} type="button">
                          {t('app.dockMenu.settings')}
                        </button>
                        <button className="dock-menu-item" onClick={actions.chooseLogDirectory} type="button">
                          {t('app.dockMenu.changeLogs')}
                        </button>
                        <button className="dock-menu-item" onClick={actions.refreshScan} type="button">
                          {t('app.dockMenu.refresh')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </aside>
              ) : null}
              <MessageFeed
                channels={state.channels}
                hasMoreHistory={selectedChannelState?.hasMore ?? false}
                isLoadingMessages={selectedChannelState?.loading ?? false}
                messages={selectedChannelState?.messages ?? []}
                portraits={state.portraits}
                onLoadOlder={() => {
                  if (selectedChannelName) {
                    void actions.loadOlderChannelMessages(selectedChannelName)
                  }
                }}
                selectedChannelName={selectedChannelName}
                selectedCharacterLabel={selectedCharacter?.label ?? null}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
