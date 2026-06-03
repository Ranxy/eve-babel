import { useTranslation } from 'react-i18next'

import type { CharacterSummary } from '../../shared/types'

interface CharacterPickerProps {
  characters: CharacterSummary[]
  selectedCharacterId: string | null
  onSelectCharacter: (characterId: string) => void
}

export function CharacterPicker(props: CharacterPickerProps) {
  const { t } = useTranslation()
  return (
    <section className="border border-border bg-panel-hero-surface rounded-3xl p-3.5 backdrop-blur-[18px]">
      <div className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('characterPicker.eyebrow')}</div>
      <h1>{t('characterPicker.title')}</h1>
      <p className="text-muted m-0 max-w-[72ch]">
        {t('characterPicker.description')}
      </p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {props.characters.map((character) => {
          const isSelected = character.characterId === props.selectedCharacterId

          return (
            <button
              key={character.characterId}
              className={`p-4 rounded-2xl border border-border bg-settings-field-surface text-inherit text-left grid gap-1.5 ${
                isSelected
                  ? 'border-[rgba(111,140,149,0.32)] bg-row-hover-surface'
                  : 'hover:border-[rgba(111,140,149,0.32)] hover:bg-row-hover-surface'
              }`}
              onClick={() => props.onSelectCharacter(character.characterId)}
              type="button"
            >
              <span className="font-bold">{character.label}</span>
              <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('characterPicker.characterId', { id: character.characterId })}</span>
              <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('characterPicker.channels', { count: character.availableChannelCount })}</span>
              <span className="block text-muted text-[0.72rem] uppercase tracking-[0.16em]">{t('characterPicker.sessions', { count: character.logFileCount })}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}