import type { CharacterSummary } from '../../shared/types'

export class CharacterRegistry {
  private characters: CharacterSummary[] = []
  private selectedCharacterId: string | null = null

  setCharacters(characters: CharacterSummary[], selectedCharacterId: string | null): void {
    this.characters = characters
    const hasSelectedCharacter = selectedCharacterId
      ? characters.some((character) => character.characterId === selectedCharacterId)
      : false

    this.selectedCharacterId = hasSelectedCharacter ? selectedCharacterId : characters[0]?.characterId ?? null
  }

  getCharacters(): CharacterSummary[] {
    return this.characters
  }

  getSelectedCharacterId(): string | null {
    return this.selectedCharacterId
  }

  selectCharacter(characterId: string): void {
    if (this.characters.some((character) => character.characterId === characterId)) {
      this.selectedCharacterId = characterId
    }
  }
}