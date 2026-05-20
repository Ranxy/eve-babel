import { useEffect, useState } from 'react'

import { ChannelList } from './components/ChannelList'
import { MessageFeed } from './components/MessageFeed'
import { SettingsPanel } from './components/SettingsPanel'
import { StatusBar } from './components/StatusBar'
import { useAppStore } from './store/appStore'

export function App() {
  const { state, actions } = useAppStore()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedChannelName, setSelectedChannelName] = useState<string | null>(null)

  useEffect(() => {
    return window.eveBabel.onOpenSettings(() => {
      setIsSettingsOpen(true)
    })
  }, [])

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

  if (state.loading && state.characters.length === 0) {
    return <div className="app-shell loading-shell">Loading EVE Babel…</div>
  }

  const showForcedLlmSetup = state.directoryStatus.exists && !state.apiStatus.configured
  const showSettingsPage = isSettingsOpen || showForcedLlmSetup
  const selectedCharacter = state.characters.find((character) => character.characterId === state.config.selectedCharacterId) ?? state.characters[0] ?? null

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <main className="app-layout">
        <StatusBar
          apiStatus={state.apiStatus}
          characters={state.characters}
          directoryStatus={state.directoryStatus}
          selectedCharacterId={state.config.selectedCharacterId}
          watcherStatus={state.watcherStatus}
          onChooseDirectory={actions.chooseLogDirectory}
          onSelectCharacter={actions.selectCharacter}
        />

        {state.error ? <div className="error-banner">{state.error}</div> : null}
        {!state.directoryStatus.exists && !isSettingsOpen ? (
          <section className="panel panel-hero">
            <div className="eyebrow">Directory Setup</div>
            <h1>Chatlogs folder not detected</h1>
            <p className="hero-copy">{state.directoryStatus.errorMessage}</p>
            <button className="primary-button" onClick={actions.chooseLogDirectory} type="button">
              Select Chatlogs folder
            </button>
          </section>
        ) : showSettingsPage ? (
          <section className="settings-page">
            <div className="panel settings-page-header">
              <div>
                <div className="eyebrow">Configuration</div>
                <h1>{showForcedLlmSetup ? 'Translation provider setup' : 'Application settings'}</h1>
                <p className="hero-copy">
                  {showForcedLlmSetup
                    ? 'Complete the provider profile before the translation pipeline starts.'
                    : 'Manage translation behavior and provider credentials outside the main message workspace.'}
                </p>
              </div>
              {!showForcedLlmSetup ? (
                <button className="ghost-button settings-page-action" onClick={() => setIsSettingsOpen(false)} type="button">
                  Back to workspace
                </button>
              ) : null}
            </div>
            <SettingsPanel
              apiStatus={state.apiStatus}
              config={state.config}
              forceLlmSetup={showForcedLlmSetup}
              onSave={actions.updateSettings}
            />
          </section>
        ) : state.characters.length === 0 ? (
          <section className="panel panel-hero">
            <div className="eyebrow">No Characters</div>
            <h1>No chat characters found</h1>
            <p className="hero-copy">Add or select an EVE Chatlogs directory that contains character chat history.</p>
          </section>
        ) : (
          <div className="workspace-grid">
            <ChannelList
              channels={state.channels}
              selectedChannelName={selectedChannelName}
              onSelectChannel={setSelectedChannelName}
              onToggleChannel={actions.setChannelEnabled}
            />
            <MessageFeed
              channels={state.channels}
              messages={state.recentMessages}
              selectedChannelName={selectedChannelName}
              selectedCharacterLabel={selectedCharacter?.label ?? null}
            />
          </div>
        )}
      </main>
    </div>
  )
}