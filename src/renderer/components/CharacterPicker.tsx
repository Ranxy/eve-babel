import type { CharacterSummary } from '../../shared/types'

interface CharacterPickerProps {
  characters: CharacterSummary[]
  selectedCharacterId: string | null
  onSelectCharacter: (characterId: string) => void
}

export function CharacterPicker(props: CharacterPickerProps) {
  return (
    <section className="panel panel-hero">
      <div className="eyebrow">Character Selection</div>
      <h1>Pick the active EVE pilot</h1>
      <p className="hero-copy">
        Channel discovery is scoped to one character at a time so Local, corp, and private chats stay separated by the log files that actually own them.
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
              <span className="character-meta">Character ID {character.characterId}</span>
              <span className="character-meta">{character.availableChannelCount} channels</span>
              <span className="character-meta">{character.logFileCount} sessions</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}