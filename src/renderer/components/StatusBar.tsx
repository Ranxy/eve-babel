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
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const characterMenuRef = useRef<HTMLDivElement | null>(null)
  const languageMenuRef = useRef<HTMLDivElement | null>(null)

  const selectedCharacter = useMemo(
    () => props.characters.find((character) => character.characterId === props.selectedCharacterId) ?? props.characters[0] ?? null,
    [props.characters, props.selectedCharacterId]
  )

  const selectedLocale = useMemo(() => {
    const activeLanguage = i18n.resolvedLanguage ?? i18n.language

    return (
      SUPPORTED_LOCALES.find((locale) => locale.code === activeLanguage) ??
      SUPPORTED_LOCALES.find((locale) => activeLanguage.startsWith(locale.code)) ??
      SUPPORTED_LOCALES[0]
    )
  }, [i18n.language, i18n.resolvedLanguage])

  useEffect(() => {
    if (!isCharacterMenuOpen && !isLanguageMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (!characterMenuRef.current?.contains(target)) {
        setIsCharacterMenuOpen(false)
      }

      if (!languageMenuRef.current?.contains(target)) {
        setIsLanguageMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCharacterMenuOpen(false)
        setIsLanguageMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCharacterMenuOpen, isLanguageMenuOpen])

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
        <div className="character-menu" ref={characterMenuRef}>
          <button
            aria-expanded={isCharacterMenuOpen}
            aria-haspopup="menu"
            className="character-menu-trigger"
            disabled={props.characters.length === 0}
            onClick={() => {
              setIsLanguageMenuOpen(false)
              setIsCharacterMenuOpen((current) => !current)
            }}
            type="button"
          >
            <span className="character-menu-title">{selectedCharacter?.label ?? t('statusBar.noCharacterFound')}</span>
          </button>
          {isCharacterMenuOpen ? (
            <div aria-label={t('statusBar.noCharacterFound')} className="character-menu-popover" role="menu">
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
        <div className="toolbar-pill toolbar-pill-language">
          <div className="toolbar-dropdown language-menu" ref={languageMenuRef}>
            <button
              aria-expanded={isLanguageMenuOpen}
              aria-haspopup="menu"
              aria-label={t('statusBar.uiLanguage')}
              className={`toolbar-dropdown-trigger ${isLanguageMenuOpen ? 'open' : ''}`}
              onClick={() => {
                setIsCharacterMenuOpen(false)
                setIsLanguageMenuOpen((current) => !current)
              }}
              type="button"
            >
              <span aria-hidden="true" className="toolbar-dropdown-icon">
                <svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="toolbar-dropdown-value">{selectedLocale.nativeLabel}</span>
              <span aria-hidden="true" className="toolbar-dropdown-chevron">
                <svg fill="none" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.25 4.5L6 8.25L9.75 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
              </span>
            </button>
            {isLanguageMenuOpen ? (
              <div aria-label={t('statusBar.uiLanguage')} className="language-menu-popover" role="menu">
                {SUPPORTED_LOCALES.map((locale) => {
                  const isSelected = locale.code === selectedLocale.code

                  return (
                    <button
                      aria-checked={isSelected}
                      className={`language-menu-item ${isSelected ? 'selected' : ''}`}
                      key={locale.code}
                      onClick={() => {
                        setIsLanguageMenuOpen(false)
                        changeLocale(locale.code as SupportedLocaleCode)
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {locale.nativeLabel}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
