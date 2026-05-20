import type { ChatMessage } from '../../shared/types'

export function selectHistoryMessagesForTranslation(messages: ChatMessage[], limit: number): ChatMessage[] {
  if (limit < 1 || messages.length === 0) {
    return []
  }

  return [...messages]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-limit)
    .filter((message) => message.messageType === 'chat' && (message.translationStatus === 'idle' || message.translationStatus === 'error'))
}