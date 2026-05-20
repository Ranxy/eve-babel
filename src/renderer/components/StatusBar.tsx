import { useEffect, useMemo, useRef, useState } from 'react'

import type { ApiStatus, CharacterSummary, DirectoryStatus, WatcherStatus } from '../../shared/types'

interface StatusBarProps {
  directoryStatus: DirectoryStatus
  watcherStatus: WatcherStatus
  apiStatus: ApiStatus
  characters: CharacterSummary[]
  selectedCharacterId: string | null
  isSidebarCollapsed: boolean
  onChooseDirectory: () => void
  onSelectCharacter: (characterId: string) => void
  onToggleSidebar: () => void
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCharacterMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCharacterMenuOpen])

  return (
    <section className="panel workspace-toolbar">
      <div className="workspace-toolbar-group workspace-toolbar-group-primary">
        <button
          aria-label={props.isSidebarCollapsed ? 'Show channels' : 'Hide channels'}
          className="toolbar-icon-button"
          onClick={props.onToggleSidebar}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <strong className="status-headline workspace-title">EVE Babel</strong>
        <div className="character-menu" ref={menuRef}>
          <button
            className="character-menu-trigger"
            disabled={props.characters.length === 0}
            onClick={() => setIsCharacterMenuOpen((current) => !current)}
            type="button"
          >
            <span className="character-menu-title">{selectedCharacter?.label ?? 'No character found'}</span>
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
      <div className="workspace-toolbar-group workspace-toolbar-group-secondary">
        <div className="toolbar-pill toolbar-pill-wide" title={props.directoryStatus.path ?? 'not set'}>
          <span className="toolbar-pill-label">Logs</span>
          <strong>{summarizePath(props.directoryStatus.path)}</strong>
        </div>
        <div className="toolbar-pill">
          <span className="toolbar-pill-label">Watcher</span>
          <strong>{props.watcherStatus.watchedChannels}</strong>
          <span>{props.watcherStatus.state}</span>
        </div>
        <div className="toolbar-pill">
          <span className="toolbar-pill-label">Queue</span>
          <strong>{props.apiStatus.queueLength}</strong>
          <span>{props.apiStatus.activeJobs} active</span>
        </div>
        <button className="ghost-button toolbar-utility-button" onClick={props.onChooseDirectory} type="button">
          Logs
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