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
    <section className="border border-border bg-panel-surface rounded-3xl p-3.5 backdrop-blur-[18px] relative z-20 flex items-center justify-between gap-2.5 flex-wrap py-2.5 px-3">
      <div className="flex items-center gap-2 flex-[1_1_420px] justify-start">
        <button
          aria-label={props.isSidebarCollapsed ? t('statusBar.showChannels') : t('statusBar.hideChannels')}
          className="size-[34px] rounded-md border border-border bg-ghost-button-surface text-text p-0 grid justify-items-center content-center gap-1 active:translate-y-px"
          onClick={props.onToggleSidebar}
          type="button"
        >
          <span className="w-[14px] h-0.5 rounded-full bg-current block" />
          <span className="w-[14px] h-0.5 rounded-full bg-current block" />
          <span className="w-[14px] h-0.5 rounded-full bg-current block" />
        </button>
        <strong className="text-[0.98rem] font-bold flex-none mr-1">EVE Babel</strong>
        <div className="relative z-30" ref={characterMenuRef}>
          <button
            aria-expanded={isCharacterMenuOpen}
            aria-haspopup="menu"
            className="min-w-[188px] border border-border rounded-lg py-2 px-2.5 bg-menu-trigger-surface text-inherit text-left grid gap-1 disabled:opacity-60 active:translate-y-px"
            disabled={props.characters.length === 0}
            onClick={() => {
              setIsLanguageMenuOpen(false)
              setIsCharacterMenuOpen((current) => !current)
            }}
            type="button"
          >
            <span className="font-bold">{selectedCharacter?.label ?? t('statusBar.noCharacterFound')}</span>
          </button>
          {isCharacterMenuOpen ? (
            <div aria-label={t('statusBar.noCharacterFound')} className="absolute top-[calc(100%+8px)] left-0 z-50 w-[min(320px,82vw)] p-2 rounded-2xl bg-menu-popover-surface border border-border shadow-[var(--menu-popover-shadow)] grid gap-1" role="menu">
              {props.characters.map((character) => {
                const isSelected = character.characterId === selectedCharacter?.characterId

                return (
                  <button
                    className={`border border-transparent rounded-lg py-2.5 px-3 bg-transparent text-inherit text-left grid gap-1 ${
                      isSelected
                        ? 'bg-row-hover-surface border-border'
                        : 'hover:bg-row-hover-surface hover:border-border focus-visible:bg-row-hover-surface focus-visible:border-border focus-visible:outline-none'
                    }`}
                    key={character.characterId}
                    onClick={() => {
                      setIsCharacterMenuOpen(false)
                      props.onSelectCharacter(character.characterId)
                    }}
                    type="button"
                  >
                    <span>{character.label}</span>
                    <span className="text-muted">{t('channelList.total', { count: character.availableChannelCount })}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-[1_1_520px] justify-end">
        <label className="min-h-[34px] py-1.5 px-2.5 rounded-full border border-border bg-status-card-surface inline-flex items-center gap-2.5 text-xs whitespace-nowrap">
          <span className="text-muted text-[0.68rem] uppercase tracking-[0.14em]">{t('statusBar.targetLanguage')}</span>
          <select
            className="min-w-[180px] border-none bg-transparent text-inherit font-semibold outline-none"
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
        <div className="min-h-[34px] py-1.5 px-2.5 rounded-full border border-border bg-status-card-surface inline-flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-muted text-[0.68rem] uppercase tracking-[0.14em]">{t('statusBar.queue')}</span>
          <strong>{props.apiStatus.queueLength}</strong>
          <span>{t('statusBar.active', { count: props.apiStatus.activeJobs })}</span>
        </div>
        <div className="min-h-[34px] py-0.5 px-[5px] overflow-visible rounded-full border border-border bg-status-card-surface inline-flex items-center gap-2 text-xs whitespace-nowrap">
          <div className="relative" ref={languageMenuRef}>
            <button
              aria-expanded={isLanguageMenuOpen}
              aria-haspopup="menu"
              aria-label={t('statusBar.uiLanguage')}
              className={`group/lang min-h-7 border border-transparent rounded-lg py-1 pr-2 pl-1.5 bg-transparent text-inherit inline-flex items-center gap-[7px] font-bold transition-[background-color,border-color,box-shadow,transform] duration-140 ease ${
                isLanguageMenuOpen
                  ? 'border-border bg-row-hover-surface outline-none'
                  : 'hover:border-border hover:bg-row-hover-surface focus-visible:border-border focus-visible:bg-row-hover-surface focus-visible:outline-none'
              } active:translate-y-px`}
              onClick={() => {
                setIsCharacterMenuOpen(false)
                setIsLanguageMenuOpen((current) => !current)
              }}
              type="button"
            >
              <span aria-hidden="true" className="size-5 rounded-sm bg-[linear-gradient(135deg,rgba(111,140,149,0.16),rgba(111,140,149,0.06))] text-accent-cold grid place-items-center flex-none [&_svg]:size-[14px] [&_svg]:block">
                <svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="tracking-[-0.01em] leading-none">{selectedLocale.nativeLabel}</span>
              <span aria-hidden="true" className={`text-muted grid place-items-center transition-transform duration-140 ease [&_svg]:size-3 ${isLanguageMenuOpen ? 'rotate-180' : ''}`}>
                <svg fill="none" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.25 4.5L6 8.25L9.75 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
              </span>
            </button>
            {isLanguageMenuOpen ? (
              <div aria-label={t('statusBar.uiLanguage')} className="absolute top-[calc(100%+8px)] right-0 z-50 w-[min(224px,82vw)] p-2 rounded-3xl bg-menu-popover-surface border border-border shadow-[var(--menu-popover-shadow)] grid gap-1" role="menu">
                {SUPPORTED_LOCALES.map((locale) => {
                  const isSelected = locale.code === selectedLocale.code

                  return (
                    <button
                      aria-checked={isSelected}
                      className={`border border-transparent rounded-lg py-[11px] px-3 bg-transparent text-inherit text-left font-bold ${
                        isSelected
                          ? 'bg-row-hover-surface border-border'
                          : 'hover:bg-row-hover-surface hover:border-border focus-visible:bg-row-hover-surface focus-visible:border-border focus-visible:outline-none'
                      }`}
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
