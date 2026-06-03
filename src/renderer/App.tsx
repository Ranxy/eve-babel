import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChannelList } from './components/ChannelList'
import { MessageFeed } from './components/MessageFeed'
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
  const isOverlayWindow = urlParams.get('view') === 'overlay'
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
    return <div className="h-screen grid place-items-center">Loading EVE Babel…</div>
  }

  const showForcedLlmSetup = state.directoryStatus.exists && !state.apiStatus.configured
  const selectedCharacter = state.characters.find((character) => character.characterId === state.config.selectedCharacterId) ?? state.characters[0] ?? null
  const selectedChannelState =
    selectedCharacter && selectedChannelName
      ? state.channelMessages[buildChannelStateKey(selectedCharacter.characterId, selectedChannelName)]
      : undefined

  if (isOverlayWindow && overlayChannelName) {
    return <OverlayView channelName={overlayChannelName} />
  }

  if (isSettingsWindow) {
    return (
      <div className="h-screen relative overflow-hidden">
        <div className="fixed inset-0 bg-backdrop-surface pointer-events-none" />
        <main className="relative w-full h-full max-w-[1260px] mx-auto py-2.5 px-3.5 flex flex-col gap-2.5 overflow-hidden">
          {state.error ? <div className="rounded-xl py-3 px-3.5 border border-[rgba(182,95,85,0.2)] bg-error-surface">{state.error}</div> : null}
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
    <div className="h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-backdrop-surface pointer-events-none" />
      <main className="relative w-full h-full max-w-[1580px] mx-auto py-2.5 px-3.5 flex flex-col gap-2.5">
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

        {state.error ? <div className="rounded-xl py-3 px-3.5 border border-[rgba(182,95,85,0.2)] bg-error-surface">{state.error}</div> : null}
        <section className="flex-1 min-h-0 flex">
          {!state.directoryStatus.exists ? (
            <section className="border border-border bg-panel-hero-surface rounded-3xl p-3.5 backdrop-blur-[18px] w-full grid content-center justify-items-start gap-2.5">
              <div className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('app.directorySetup.eyebrow')}</div>
              <h1 className="m-0 font-sans font-bold text-[clamp(1.8rem,3vw,2.8rem)] max-w-[15ch]">{t('app.directorySetup.title')}</h1>
              <p className="text-muted m-0 max-w-[72ch]">{state.directoryStatus.errorMessage}</p>
              <button className="rounded-full py-2 px-3.5 border border-transparent bg-primary-button-surface text-primary-button-text font-bold active:translate-y-px" onClick={actions.chooseLogDirectory} type="button">
                {t('app.directorySetup.cta')}
              </button>
            </section>
          ) : showForcedLlmSetup ? (
            <section className="border border-border bg-panel-hero-surface rounded-3xl p-3.5 backdrop-blur-[18px] w-full grid content-center justify-items-start gap-2.5">
              <div className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('app.providerSetup.eyebrow')}</div>
              <h1 className="m-0 font-sans font-bold text-[clamp(1.8rem,3vw,2.8rem)] max-w-[15ch]">{t('app.providerSetup.title')}</h1>
              <p className="text-muted m-0 max-w-[72ch]">{t('app.providerSetup.description')}</p>
              <button className="rounded-full py-2 px-3.5 border border-transparent bg-primary-button-surface text-primary-button-text font-bold active:translate-y-px" onClick={actions.openSettingsWindow} type="button">
                {t('app.providerSetup.cta')}
              </button>
            </section>
          ) : state.characters.length === 0 ? (
            <section className="border border-border bg-panel-hero-surface rounded-3xl p-3.5 backdrop-blur-[18px] w-full grid content-center justify-items-start gap-2.5">
              <div className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('app.noCharacters.eyebrow')}</div>
              <h1 className="m-0 font-sans font-bold text-[clamp(1.8rem,3vw,2.8rem)] max-w-[15ch]">{t('app.noCharacters.title')}</h1>
              <p className="text-muted m-0 max-w-[72ch]">{t('app.noCharacters.description')}</p>
            </section>
          ) : (
            <div className={`flex-1 min-h-0 grid gap-2.5 ${isSidebarCollapsed ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[248px_minmax(0,1fr)]'}`}>
              {!isSidebarCollapsed ? (
                <aside className="border border-border bg-panel-surface rounded-3xl p-2.5 backdrop-blur-[18px] min-h-0 flex flex-col gap-2.5">
                  <ChannelList
                    channels={state.channels}
                    selectedChannelName={selectedChannelName}
                    onSelectChannel={setSelectedChannelName}
                    onToggleChannel={actions.setChannelEnabled}
                    onTogglePinned={actions.setChannelPinned}
                  />
                  <div
                    className="relative mt-auto pt-1.5"
                    onPointerEnter={openDockMenu}
                    onPointerLeave={scheduleDockMenuClose}
                    ref={dockMenuRef}
                  >
                    <button
                      aria-expanded={isDockMenuOpen}
                      aria-haspopup="menu"
                      className="w-full min-h-9 rounded-lg border border-border bg-menu-trigger-surface text-text text-lg active:translate-y-px"
                      onClick={() => setIsDockMenuOpen((current) => !current)}
                      onFocus={openDockMenu}
                      type="button"
                    >
                      ...
                    </button>
                    {isDockMenuOpen ? (
                      <div className="absolute left-0 bottom-[calc(100%+2px)] min-w-[210px] p-2 rounded-2xl bg-menu-popover-surface border border-border shadow-[var(--menu-popover-shadow)] grid gap-1 z-[6]" role="menu">
                        <button className="border-none rounded-lg bg-transparent text-inherit text-left py-2.5 px-3 hover:bg-row-hover-surface focus-visible:bg-row-hover-surface" onClick={actions.openSettingsWindow} type="button">
                          {t('app.dockMenu.settings')}
                        </button>
                        <button className="border-none rounded-lg bg-transparent text-inherit text-left py-2.5 px-3 hover:bg-row-hover-surface focus-visible:bg-row-hover-surface" onClick={actions.chooseLogDirectory} type="button">
                          {t('app.dockMenu.changeLogs')}
                        </button>
                        <button className="border-none rounded-lg bg-transparent text-inherit text-left py-2.5 px-3 hover:bg-row-hover-surface focus-visible:bg-row-hover-surface" onClick={actions.refreshScan} type="button">
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
