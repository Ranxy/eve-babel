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
    <section className="panel panel-hero">
      <div className="eyebrow">{t('characterPicker.eyebrow')}</div>
      <h1>{t('characterPicker.title')}</h1>
      <p className="hero-copy">
        {t('characterPicker.description')}
      </p>
      <div className="character-grid">
        {props.characters.map((character) => {
          const isSelected = character.characterId === props.selectedCharacterId

          return (
            <button
              key={character.characterId}
              className={`character-card ${isSelected ? 'selected' : ''}`}
              onClick={() => props.onSelectCharacter(character.characterId)}
              type="button"
            >
              <span className="character-label">{character.label}</span>
              <span className="character-meta">{t('characterPicker.characterId', { id: character.characterId })}</span>
              <span className="character-meta">{t('characterPicker.channels', { count: character.availableChannelCount })}</span>
              <span className="character-meta">{t('characterPicker.sessions', { count: character.logFileCount })}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}