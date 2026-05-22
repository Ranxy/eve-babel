import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TARGET_LANGUAGE_OPTIONS, type ApiStatus, type AppConfig, type CharacterSummary } from '../../shared/types'
import { SUPPORTED_LOCALES, changeLocale, type SupportedLocaleCode } from '../i18n/index'


interface StatusBarProps {
  apiStatus: ApiStatus
  characters: CharacterSummary[]
  selectedCharacterId: string | null
  targetLanguage: AppConfig['targetLanguage']
  isSidebarCollapsed: boolean
  onSelectCharacter: (characterId: string) => void
  onSelectTargetLanguage: (targetLanguage: AppConfig['targetLanguage']) => void
  onToggleSidebar: () => void
}

export function StatusBar(props: StatusBarProps) {
  const { t, i18n } = useTranslation()
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
          aria-label={props.isSidebarCollapsed ? t('statusBar.showChannels') : t('statusBar.hideChannels')}
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
            <span className="character-menu-title">{selectedCharacter?.label ?? t('statusBar.noCharacterFound')}</span>
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
                    <span className="character-menu-item-meta">{t('channelList.total', { count: character.availableChannelCount })}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
      <div className="workspace-toolbar-group workspace-toolbar-group-secondary">
        <label className="toolbar-pill toolbar-pill-select">
          <span className="toolbar-pill-label">{t('statusBar.targetLanguage')}</span>
          <select
            className="toolbar-select-field"
            value={props.targetLanguage}
            onChange={(event) => props.onSelectTargetLanguage(event.target.value as AppConfig['targetLanguage'])}
          >
            {TARGET_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="toolbar-pill">
          <span className="toolbar-pill-label">{t('statusBar.queue')}</span>
          <strong>{props.apiStatus.queueLength}</strong>
          <span>{t('statusBar.active', { count: props.apiStatus.activeJobs })}</span>
        </div>
        <label className="toolbar-pill toolbar-pill-select">
          <span className="toolbar-pill-label">{t('statusBar.uiLanguage')}</span>
          <select
            className="toolbar-select-field toolbar-select-field-narrow"
            value={i18n.language}
            onChange={(event) => changeLocale(event.target.value as SupportedLocaleCode)}
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.nativeLabel}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
