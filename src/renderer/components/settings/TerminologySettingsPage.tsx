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

  const hoverLang = TARGET_LANGUAGE_OPTIONS.find((o) => o.value === props.targetLanguage)
  const usedLanguages = new Set(Object.keys(rawTerms))
  const availableLanguages = TARGET_LANGUAGE_OPTIONS.filter((opt) => !usedLanguages.has(opt.value))

  return (
    <div className="settings-page-stack">
      <div className="settings-note-grid">
        <div className="settings-note">
          <span className="settings-note-label">{t('terminologySettings.summary.label')}</span>
          <strong>{t('terminologySettings.summary.count', { count: props.glossary.length })}</strong>
          <span className="settings-field-hint">{t('terminologySettings.summary.hint')}</span>
        </div>
        <div className="settings-note">
          <span className="settings-note-label">{t('terminologySettings.activeLanguage.label')}</span>
          <strong>{hoverLang?.label ?? props.targetLanguage}</strong>
          <span className="settings-field-hint">{t('terminologySettings.activeLanguage.hint')}</span>
        </div>
      </div>

      {props.glossary.length > 0 && (
        <div className="terminology-search-row">
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

      <div className="terminology-content">
        <div className="terminology-list-panel">
          {props.glossary.length === 0 ? (
            <div className="terminology-empty">
              <p className="terminology-empty-text">{t('terminologySettings.emptyState')}</p>
              <button className="primary-button" type="button" onClick={handleStartAdd}>
                {t('terminologySettings.actions.addFirst')}
              </button>
            </div>
          ) : (
            <>
              <div className="terminology-list-header">
                <span className="eyebrow">{t('terminologySettings.termsLabel')}</span>
                <button className="ghost-button" type="button" onClick={handleStartAdd}>
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
                    <div className="terminology-term-row" key={entry.id}>
                      <button className="terminology-term-info" type="button" onClick={() => openEditor(entry)}>
                        {first && (
                          <span className="terminology-term-name">
                            <span className="terminology-term-name-lang">{first[0]}: </span>
                            {variantsToText(first[1])}
                          </span>
                        )}
                        <span className="terminology-term-translations">
                          {rest.map(([lang, variants]) => (
                            <span className="terminology-term-lang" key={lang}>
                              {lang}: {variantsToText(variants)}
                            </span>
                          ))}
                          {overflow > 0 && <span className="terminology-term-lang">+{overflow}</span>}
                        </span>
                      </button>
                      <button
                        className="ghost-button terminology-delete-btn"
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
        </div>

        {editingEntry && (
          <div className="terminology-editor-panel">
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
                  <span className="eyebrow">{t('terminologySettings.editor.notesLabel')}</span>
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
                  <span className="eyebrow">{t('terminologySettings.editor.termsLabel')}</span>
                  {availableLanguages.length > 0 && (
                    <select
                      className="terminology-lang-add-select"
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
                  <div className="terminology-no-langs">
                    {t('terminologySettings.editor.noLanguages')}
                  </div>
                ) : (
                  <div className="terminology-langs-list">
                    {Object.entries(rawTerms).map(([lang, variants]) => {
                      const langLabel =
                        TARGET_LANGUAGE_OPTIONS.find((o) => o.value === lang)?.label ?? lang
                      return (
                        <div className="terminology-lang-row" key={lang}>
                          <span className="terminology-lang-label">{langLabel}</span>
                          <div className="terminology-lang-chip-area">
                            <ChipInput
                              placeholder={t('terminologySettings.editor.termPlaceholder')}
                              values={variants}
                              onChange={(next) => handleTermsChange(lang, next)}
                            />
                          </div>
                          <button
                            className="ghost-button terminology-lang-remove-btn"
                            title={t('terminologySettings.editor.removeLanguage')}
                            type="button"
                            onClick={() => handleRemoveLanguage(lang)}
                          >
                            ✕
                          </button>
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
                <button className="ghost-button" type="button" onClick={handleCancelEdit}>
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
    </div>
  )
}

// ── ChipInput ────────────────────────────────────────────────────────────

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
    <div className="chip-input-container" onClick={focusInput}>
      {values.map((value, index) => (
        <span className="chip-input-chip" key={index}>
          <span className="chip-input-chip-text">{value}</span>
          <button
            className="chip-input-chip-remove"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeChip(index)
            }}
            tabIndex={-1}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="chip-input-field"
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

// ── Icons ────────────────────────────────────────────────────────────────

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
