import { useEffect, useMemo, useRef, useState } from 'react'

import type { ApiStatus, CharacterSummary, DirectoryStatus, WatcherStatus } from '../../shared/types'

interface StatusBarProps {
  directoryStatus: DirectoryStatus
  watcherStatus: WatcherStatus
  apiStatus: ApiStatus
  characters: CharacterSummary[]
  selectedCharacterId: string | null
  onChooseDirectory: () => void
  onSelectCharacter: (characterId: string) => void
}

export function StatusBar(props: StatusBarProps) {
  const [isCharacterMenuOpen, setIsCharacterMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const selectedCharacter = useMemo(
    () => props.characters.find((character) => character.characterId === props.selectedCharacterId) ?? props.characters[0] ?? null,
    [props.characters, props.selectedCharacterId]
  )

  useEffect(() => {
    if (!isCharacterMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsCharacterMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isCharacterMenuOpen])

  return (
    <section className="status-bar">
      <div className="status-bar-primary">
        <div>
          <span className="status-label">Active pilot</span>
          <strong>EVE Babel</strong>
        </div>
        <div className="character-menu" ref={menuRef}>
          <button
            className="character-menu-trigger"
            disabled={props.characters.length === 0}
            onClick={() => setIsCharacterMenuOpen((current) => !current)}
            type="button"
          >
            <span className="character-menu-title">{selectedCharacter?.label ?? 'No character found'}</span>
            <span className="character-menu-meta">
              {selectedCharacter ? `${selectedCharacter.availableChannelCount} channels` : 'Import chatlogs to begin'}
            </span>
          </button>
          {isCharacterMenuOpen ? (
            <div className="character-menu-popover">
              {props.characters.map((character) => {
                const isSelected = character.characterId === selectedCharacter?.characterId

                return (
                  <button
                    className={`character-menu-item ${isSelected ? 'selected' : ''}`}
                    key={character.characterId}
                    onClick={() => {
                      setIsCharacterMenuOpen(false)
                      props.onSelectCharacter(character.characterId)
                    }}
                    type="button"
                  >
                    <span>{character.label}</span>
                    <span className="character-menu-item-meta">{character.availableChannelCount} channels</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
      <div className="status-metric-row">
        <div className="status-metric-card status-metric-card-wide" title={props.directoryStatus.path ?? 'not set'}>
          <span className="status-label">Logs</span>
          <strong>{summarizePath(props.directoryStatus.path)}</strong>
        </div>
        <div className="status-metric-card">
          <span className="status-label">Watcher</span>
          <strong>{props.watcherStatus.state}</strong>
        </div>
        <div className="status-metric-card">
          <span className="status-label">Queue</span>
          <strong>{props.apiStatus.queueLength}</strong>
        </div>
        <button className="ghost-button" onClick={props.onChooseDirectory} type="button">
          Change directory
        </button>
      </div>
    </section>
  )
}

function summarizePath(path: string | null): string {
  if (!path) {
    return 'not set'
  }

  const parts = path.split(/\\|\//u).filter(Boolean)
  return parts.slice(-2).join(' / ')
}