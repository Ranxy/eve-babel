import type { ChannelSummary } from '../../shared/types'

export class ChannelRegistry {
  private channelsByCharacter: Record<string, ChannelSummary[]> = {}

  setChannels(
    channelsByCharacter: Record<string, ChannelSummary[]>,
    enabledChannels: Record<string, string[]>,
    pinnedChannels: Record<string, string[]>
  ): void {
    this.channelsByCharacter = Object.fromEntries(
      Object.entries(channelsByCharacter).map(([characterId, channels]) => {
        const enabledSet = new Set(enabledChannels[characterId] ?? [])
        const pinnedSet = new Set(pinnedChannels[characterId] ?? [])

        return [
          characterId,
          channels
            .map((channel) => ({
              ...channel,
              enabled: enabledSet.has(channel.channelName),
              pinned: pinnedSet.has(channel.channelName)
            }))
            .sort((left, right) => {
              if (left.pinned !== right.pinned) {
                return left.pinned ? -1 : 1
              }

              return left.channelName.localeCompare(right.channelName)
            })
        ]
      })
    )
  }

  getChannels(characterId: string | null): ChannelSummary[] {
    return characterId ? this.channelsByCharacter[characterId] ?? [] : []
  }
}