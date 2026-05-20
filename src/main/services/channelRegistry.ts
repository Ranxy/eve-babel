import type { ChannelSummary } from '../../shared/types'

export class ChannelRegistry {
  private channelsByCharacter: Record<string, ChannelSummary[]> = {}

  setChannels(channelsByCharacter: Record<string, ChannelSummary[]>, enabledChannels: Record<string, string[]>): void {
    this.channelsByCharacter = Object.fromEntries(
      Object.entries(channelsByCharacter).map(([characterId, channels]) => {
        const enabledSet = new Set(enabledChannels[characterId] ?? [])

        return [
          characterId,
          channels.map((channel) => ({
            ...channel,
            enabled: enabledSet.has(channel.channelName)
          }))
        ]
      })
    )
  }

  getChannels(characterId: string | null): ChannelSummary[] {
    return characterId ? this.channelsByCharacter[characterId] ?? [] : []
  }
}