import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TARGET_LANGUAGE_OPTIONS, type GlossaryEntry } from '../../../shared/types'

interface TerminologySettingsPageProps {
  glossary: GlossaryEntry[]
  targetLanguage: string
  onAddGlossaryEntry: (entry: { notes?: string; terms: Record<string, string[]> }) => void
  onUpdateGlossaryEntry: (entry: GlossaryEntry) => void
  onDeleteGlossaryEntry: (id: string) => void
}

function variantsToText(variants: string[] | undefined): string {
  if (!Array.isArray(variants) || variants.length === 0) return ''
  return variants.join(', ')
}

export function TerminologySettingsPage(props: TerminologySettingsPageProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingEntry, setEditingEntry] = useState<GlossaryEntry | null>(null)
  const [rawTerms, setRawTerms] = useState<Record<string, string[]>>({})

  const filteredGlossary = useMemo(() => {
    if (!searchQuery.trim()) {
      return props.glossary
    }
    const lower = searchQuery.toLowerCase()
    return props.glossary.filter((entry) =>
      Object.entries(entry.terms).some(([, variants]) =>
        variants.some((v) => v.toLowerCase().includes(lower))
      )
    )
  }, [props.glossary, searchQuery])

  const openEditor = (entry: GlossaryEntry) => {
    setRawTerms({ ...entry.terms })
    setEditingEntry(entry)
  }

  const handleStartAdd = () => {
    setRawTerms({ [props.targetLanguage]: [] })
    setEditingEntry({ id: '', notes: '', terms: {} })
  }

  const handleCancelEdit = () => {
    setEditingEntry(null)
    setRawTerms({})
  }

  const handleTermsChange = (lang: string, variants: string[]) => {
    setRawTerms((prev) => ({ ...prev, [lang]: variants }))
  }

  const handleRemoveLanguage = (lang: string) => {
    setRawTerms((prev) => {
      const next = { ...prev }
      delete next[lang]
      return next
    })
  }

  const handleAddLanguage = (lang: string) => {
    setRawTerms((prev) => ({ ...prev, [lang]: [] }))
  }

  const handleSaveEntry = () => {
    if (!editingEntry) return

    const parsedTerms: Record<string, string[]> = {}
    for (const [lang, variants] of Object.entries(rawTerms)) {
      if (variants.length > 0) {
        parsedTerms[lang] = variants
      }
    }

    if (Object.keys(parsedTerms).length === 0) return

    const notes = editingEntry.notes?.trim() || undefined

    if (editingEntry.id) {
      props.onUpdateGlossaryEntry({ ...editingEntry, notes, terms: parsedTerms })
    } else {
      props.onAddGlossaryEntry({ notes, terms: parsedTerms })
    }

    setEditingEntry(null)
    setRawTerms({})
  }

  const handleDeleteEntry = (id: string) => {
    props.onDeleteGlossaryEntry(id)
    if (editingEntry?.id === id) {
      setEditingEntry(null)
      setRawTerms({})
    }
  }

  const usedLanguages = new Set(Object.keys(rawTerms))
  const availableLanguages = TARGET_LANGUAGE_OPTIONS.filter((opt) => !usedLanguages.has(opt.value))

  return (
    <div className="settings-page-stack">
      {props.glossary.length > 0 && (
        <div className="mb-2">
          <label className="providers-search-field">
            <SearchIcon />
            <input
              placeholder={t('terminologySettings.searchPlaceholder')}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>
      )}

      {props.glossary.length === 0 && !editingEntry ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
          <p className="text-muted text-sm leading-relaxed max-w-[420px] m-0">{t('terminologySettings.emptyState')}</p>
          <button className="rounded-full py-2 px-3.5 border border-transparent bg-primary-button-surface text-primary-button-text font-bold active:translate-y-px disabled:opacity-50" type="button" onClick={handleStartAdd}>
            {t('terminologySettings.actions.addFirst')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('terminologySettings.termsLabel')}</span>
            <button className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px" type="button" onClick={handleStartAdd}>
              <PlusIcon />
              {t('terminologySettings.actions.addTerm')}
            </button>
          </div>
          <div className="providers-model-list">
            {filteredGlossary.map((entry) => {
              const entries = Object.entries(entry.terms)
              const first = entries[0]
              const rest = entries.slice(1, 3)
              const overflow = entries.length > 3 ? entries.length - 3 : 0

              return (
                <div className="flex items-center border-b border-border py-1.5" key={entry.id}>
                  <button className="flex flex-col gap-0.5 flex-1 min-w-0 bg-none border-none cursor-pointer text-left py-1.5 text-text hover:text-accent" type="button" onClick={() => openEditor(entry)}>
                    {first && (
                      <span className="font-semibold text-sm font-mono">
                        <span className="font-normal text-[0.72rem] text-muted font-sans uppercase tracking-[0.03em]">{first[0]}: </span>
                        {variantsToText(first[1])}
                      </span>
                    )}
                    <span className="flex flex-wrap gap-1 gap-x-2">
                      {rest.map(([lang, variants]) => (
                        <span className="text-xs text-muted" key={lang}>
                          {lang}: {variantsToText(variants)}
                        </span>
                      ))}
                      {overflow > 0 && <span className="text-xs text-muted">+{overflow}</span>}
                    </span>
                  </button>
                  <button
                    className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px shrink-0 !text-[#e74c3c]"
                    title={t('terminologySettings.actions.delete')}
                    type="button"
                    onClick={() => handleDeleteEntry(entry.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {editingEntry && (
          <div className="mt-4 pl-4 border-l border-border">
            <div className="providers-detail">
              <div className="providers-detail-top">
                <h2 className="providers-detail-title">
                  {editingEntry.id
                    ? t('terminologySettings.editor.editTitle')
                    : t('terminologySettings.editor.newTitle')}
                </h2>
                <p className="providers-detail-desc">{t('terminologySettings.editor.description')}</p>
              </div>

              <hr className="providers-divider" />

              <div className="providers-form-section">
                <div className="providers-form-section-head">
                  <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('terminologySettings.editor.notesLabel')}</span>
                </div>
                <input
                  className="providers-text-input"
                  placeholder={t('terminologySettings.editor.notesPlaceholder')}
                  spellCheck={false}
                  value={editingEntry.notes ?? ''}
                  onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, notes: e.target.value } : null))}
                />
              </div>

              <hr className="providers-divider" />

              <div className="providers-form-section">
                <div className="providers-form-section-head">
                  <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('terminologySettings.editor.termsLabel')}</span>
                  {availableLanguages.length > 0 && (
                    <select
                      className="text-xs py-[3px] px-1.5 border border-border rounded-md bg-white text-text cursor-pointer dark:bg-[rgba(14,21,29,0.92)]"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) handleAddLanguage(e.target.value)
                      }}
                    >
                      <option value="">{t('terminologySettings.editor.addLanguage')}</option>
                      {availableLanguages.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {Object.keys(rawTerms).length === 0 ? (
                  <div className="text-muted text-sm py-3">
                    {t('terminologySettings.editor.noLanguages')}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {Object.entries(rawTerms).map(([lang, variants]) => {
                      const langLabel =
                        TARGET_LANGUAGE_OPTIONS.find((o) => o.value === lang)?.label ?? lang
                      return (
                        <div className="flex items-center gap-2" key={lang}>
                          <span className="shrink-0 w-[90px] text-sm text-muted whitespace-nowrap overflow-hidden text-ellipsis">{langLabel}</span>
                          <div className="flex-1 min-w-0">
                            <ChipInput
                              placeholder={t('terminologySettings.editor.termPlaceholder')}
                              values={variants}
                              onChange={(next) => handleTermsChange(lang, next)}
                            />
                          </div>
                          <button
                            className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px shrink-0 text-xs text-muted"
                            title={t('terminologySettings.editor.removeLanguage')}
                            type="button"
                            onClick={() => handleRemoveLanguage(lang)}
                          >
                            ‚ú?                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <span className="settings-field-hint" style={{ marginTop: 6 }}>
                  {t('terminologySettings.editor.multiValueHint')}
                </span>
              </div>

              <div className="providers-custom-actions">
                <button className="rounded-full py-2 px-3.5 border border-border bg-ghost-button-surface text-text active:translate-y-px" type="button" onClick={handleCancelEdit}>
                  {t('terminologySettings.editor.cancel')}
                </button>
                <button
                  className="providers-save-btn"
                  disabled={Object.values(rawTerms).every((v) => v.length === 0)}
                  type="button"
                  onClick={handleSaveEntry}
                >
                  {editingEntry.id
                    ? t('terminologySettings.editor.saveEntry')
                    : t('terminologySettings.editor.addEntry')}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

// ‚î¢„‚î¢„ ChipInput ‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„

interface ChipInputProps {
  placeholder: string
  values: string[]
  onChange: (values: string[]) => void
}

function ChipInput({ placeholder, values, onChange }: ChipInputProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const commitText = () => {
    const trimmed = text.trim()
    if (trimmed.length === 0) return

    // Deduplicate: don't add the same variant twice
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setText('')
  }

  const removeChip = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitText()
      return
    }

    if (e.key === ',') {
      e.preventDefault()
      commitText()
      return
    }

    if (e.key === 'Backspace' && text.length === 0 && values.length > 0) {
      removeChip(values.length - 1)
    }
  }

  const handleBlur = () => {
    commitText()
  }

  const focusInput = () => {
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 min-h-[34px] py-[3px] px-2 bg-white border border-border rounded-md cursor-text transition-[border-color,outline] duration-150 focus-within:border-accent focus-within:outline-2 focus-within:outline-[rgba(111,140,149,0.28)] focus-within:outline-offset-0 dark:bg-[rgba(14,21,29,0.92)]" onClick={focusInput}>
      {values.map((value, index) => (
        <span className="inline-flex items-center gap-[3px] py-px pr-0.5 pl-2 bg-[rgba(111,140,149,0.12)] border border-[rgba(111,140,149,0.22)] rounded-[5px] text-sm leading-normal text-text select-none whitespace-nowrap" key={index}>
          <span className="max-w-[180px] overflow-hidden text-ellipsis">{value}</span>
          <button
            className="inline-flex items-center justify-center size-[18px] p-0 border-none rounded-xs bg-transparent text-muted text-[0.7rem] cursor-pointer leading-none transition-[background,color] duration-120 hover:bg-[rgba(231,76,60,0.15)] hover:text-[#e74c3c]"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeChip(index)
            }}
            tabIndex={-1}
          >
            ‚ú?          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="flex-1 min-w-[80px] border-none outline-none bg-transparent text-sm text-text py-[3px] leading-normal placeholder:text-muted"
        placeholder={values.length === 0 ? placeholder : undefined}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  )
}

// ‚î¢„‚î¢„ Icons ‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„‚î¢„

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <line x1="10" y1="10" x2="14" y2="14" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="7.5" y1="2" x2="7.5" y2="13" />
      <line x1="2" y1="7.5" x2="13" y2="7.5" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,4 13,4" />
      <line x1="5.5" y1="4" x2="5.5" y2="13" />
      <line x1="9.5" y1="4" x2="9.5" y2="13" />
      <line x1="3" y1="4.5" x2="12" y2="4" strokeDasharray="1 2" />
    </svg>
  )
}
