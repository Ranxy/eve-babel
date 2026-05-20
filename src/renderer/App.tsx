import { useEffect, useRef, useState } from 'react'

import { ChannelList } from './components/ChannelList'
import { MessageFeed } from './components/MessageFeed'
import { SettingsPanel } from './components/SettingsPanel'
import { StatusBar } from './components/StatusBar'
import { useAppStore } from './store/appStore'

export function App() {
  const { state, actions } = useAppStore()
  const [selectedChannelName, setSelectedChannelName] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDockMenuOpen, setIsDockMenuOpen] = useState(false)
  const isSettingsWindow = new URLSearchParams(window.location.search).get('view') === 'settings'
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

    for (let index = state.recentMessages.length - 1; index >= 0; index -= 1) {
      const message = state.recentMessages[index]
      if (state.channels.some((channel) => channel.channelName === message.channelName)) {
        nextChannelName = message.channelName
        break
      }
    }

    setSelectedChannelName(nextChannelName ?? state.channels[0]?.channelName ?? null)
  }, [selectedChannelName, state.channels, state.recentMessages, state.config.selectedCharacterId])

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
  const enabledChannelCount = state.channels.filter((channel) => channel.enabled).length

  if (isSettingsWindow) {
    return (
      <div className="app-shell settings-window-shell">
        <div className="app-backdrop" />
        <main className="app-layout settings-window-layout">
          <section className="panel settings-page-header">
            <div>
              <div className="eyebrow">Settings</div>
              <h1>Translation provider</h1>
              <p className="hero-copy">Adjust the translation pipeline in a dedicated window so the main workspace stays focused on live chat traffic.</p>
            </div>
          </section>
          {state.error ? <div className="error-banner">{state.error}</div> : null}
          <SettingsPanel
            apiStatus={state.apiStatus}
            config={state.config}
            forceLlmSetup={showForcedLlmSetup}
            onSave={actions.updateSettings}
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
          directoryStatus={state.directoryStatus}
          isSidebarCollapsed={isSidebarCollapsed}
          selectedCharacterId={state.config.selectedCharacterId}
          watcherStatus={state.watcherStatus}
          onChooseDirectory={actions.chooseLogDirectory}
          onSelectCharacter={actions.selectCharacter}
          onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        />

        {state.error ? <div className="error-banner">{state.error}</div> : null}
        <section className="workspace-stage">
          {!state.directoryStatus.exists ? (
            <section className="panel panel-hero workspace-placeholder">
              <div className="eyebrow">Directory Setup</div>
              <h1>Chatlogs folder not detected</h1>
              <p className="hero-copy">{state.directoryStatus.errorMessage}</p>
              <button className="primary-button" onClick={actions.chooseLogDirectory} type="button">
                Select Chatlogs folder
              </button>
            </section>
          ) : showForcedLlmSetup ? (
            <section className="panel panel-hero workspace-placeholder">
              <div className="eyebrow">Provider Setup</div>
              <h1>Translation is paused until a provider profile is configured.</h1>
              <p className="hero-copy">Open the settings entry from the dock menu, enter your endpoint, model, and API key, then return to the live workspace.</p>
              <button className="primary-button" onClick={actions.openSettingsWindow} type="button">
                Open settings window
              </button>
            </section>
          ) : state.characters.length === 0 ? (
            <section className="panel panel-hero workspace-placeholder">
              <div className="eyebrow">No Characters</div>
              <h1>No chat characters found</h1>
              <p className="hero-copy">Add or select an EVE Chatlogs directory that contains character chat history.</p>
            </section>
          ) : (
            <div className={`workspace-surface ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
              <aside className={`panel channel-dock ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                {isSidebarCollapsed ? (
                  <div className="channel-dock-collapsed-state">
                    <span className="eyebrow">Channels</span>
                    <strong>{enabledChannelCount}</strong>
                    <span className="channel-dock-collapsed-meta">live</span>
                  </div>
                ) : (
                  <ChannelList
                    channels={state.channels}
                    selectedChannelName={selectedChannelName}
                    onSelectChannel={setSelectedChannelName}
                    onToggleChannel={actions.setChannelEnabled}
                    onTogglePinned={actions.setChannelPinned}
                  />
                )}
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
                        Translation settings
                      </button>
                      <button className="dock-menu-item" onClick={actions.chooseLogDirectory} type="button">
                        Change logs folder
                      </button>
                      <button className="dock-menu-item" onClick={actions.refreshScan} type="button">
                        Refresh scan
                      </button>
                    </div>
                  ) : null}
                </div>
              </aside>
              <MessageFeed
                channels={state.channels}
                messages={state.recentMessages}
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
