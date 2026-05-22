import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { MessageRepository } from './messageRepository'

const ESI_UNIVERSE_IDS_URL = 'https://esi.evetech.net/latest/universe/ids/?datasource=tranquility&language=en'
const ESI_BATCH_SIZE = 500
const PORTRAIT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface EsiUniverseIdsResponse {
  characters?: Array<{ id: number; name: string }>
}

export class CharacterPortraitService {
  private readonly inProgress = new Set<string>()

  constructor(
    private readonly repository: MessageRepository,
    private readonly portraitsDirectory: string
  ) {}

  getAllPortraits(): Record<string, string> {
    return this.repository.getAllPortraits()
  }

  async resolvePortraits(senderNames: string[], onUpdate: (portraits: Record<string, string>) => void): Promise<void> {
    const toFetch = this.repository
      .getSendersNeedingPortraitRefresh(senderNames, PORTRAIT_MAX_AGE_MS)
      .filter((name) => !this.inProgress.has(name))

    if (toFetch.length === 0) {
      return
    }

    toFetch.forEach((name) => this.inProgress.add(name))

    try {
      await mkdir(this.portraitsDirectory, { recursive: true })

      for (let i = 0; i < toFetch.length; i += ESI_BATCH_SIZE) {
        await this.processBatch(toFetch.slice(i, i + ESI_BATCH_SIZE))
      }

      onUpdate(this.repository.getAllPortraits())
    } finally {
      toFetch.forEach((name) => this.inProgress.delete(name))
    }
  }

  private async processBatch(names: string[]): Promise<void> {
    let characters: Array<{ id: number; name: string }> = []

    try {
      const response = await fetch(ESI_UNIVERSE_IDS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(names)
      })

      if (response.ok) {
        const data = (await response.json()) as EsiUniverseIdsResponse
        characters = data.characters ?? []
      }
    } catch {
      // Network error — store nulls to avoid retrying on every message
    }

    const foundNames = new Set(characters.map((c) => c.name))
    const portraits: Array<{ senderName: string; characterId: number | null; portraitUrl: string | null }> = []

    for (const { id, name } of characters) {
      const localUrl = await this.downloadPortrait(id)
      portraits.push({ senderName: name, characterId: id, portraitUrl: localUrl })
    }

    for (const name of names.filter((n) => !foundNames.has(n))) {
      portraits.push({ senderName: name, characterId: null, portraitUrl: null })
    }

    await this.repository.upsertPortraits(portraits)
  }

  private async downloadPortrait(characterId: number): Promise<string | null> {
    const remoteUrl = `https://images.evetech.net/characters/${characterId}/portrait?size=128`
    const fileName = `${characterId}.png`
    const filePath = join(this.portraitsDirectory, fileName)

    try {
      const response = await fetch(remoteUrl)
      if (!response.ok) {
        return null
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      await writeFile(filePath, buffer)

      return `portrait://characters/${fileName}`
    } catch {
      return null
    }
  }
}
