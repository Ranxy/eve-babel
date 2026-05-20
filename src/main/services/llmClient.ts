import { DEFAULT_TRANSLATION_PROMPT, type AppConfig, type ChatMessage } from '../../shared/types'

interface LlmClientOptions {
  apiKey: string
  config: AppConfig
}

interface TranslationResponsePayload {
  translations?: Array<{
    messageId?: string
    translatedText?: string
  }>
}

export class LlmClient {
  async translateMessages(messages: ChatMessage[], options: LlmClientOptions): Promise<Map<string, string>> {
    if (messages.length === 0) {
      return new Map()
    }

    const response = await fetch(`${options.config.apiBaseUrl.replace(/\/$/u, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.config.modelName,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: buildBatchTranslationPrompt(options.config)
          },
          {
            role: 'user',
            content: JSON.stringify(
              {
                targetLanguage: options.config.targetLanguage,
                messages: messages.map((message) => ({
                  messageId: message.messageId,
                  timestamp: message.timestamp,
                  senderName: message.senderName,
                  messageText: message.messageText
                }))
              },
              null,
              2
            )
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Translation request failed with ${response.status}`)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
    }

    const content = normalizeMessageContent(payload.choices?.[0]?.message?.content)
    if (!content) {
      throw new Error('Translation response did not contain text')
    }

    const parsed = parseTranslationResponse(content)
    const translations = new Map<string, string>()
    const expectedMessageIds = new Set(messages.map((message) => message.messageId))

    for (const translation of parsed.translations ?? []) {
      const messageId = translation.messageId?.trim()
      const translatedText = translation.translatedText?.trim()

      if (!messageId || !translatedText || !expectedMessageIds.has(messageId)) {
        continue
      }

      translations.set(messageId, translatedText)
    }

    if (translations.size !== messages.length) {
      throw new Error('Translation response did not contain all requested messages')
    }

    return translations
  }

  async translateText(text: string, options: LlmClientOptions): Promise<string> {
    const translations = await this.translateMessages(
      [
        {
          messageId: 'single-message',
          timestamp: new Date(0).toISOString(),
          channelName: 'Direct',
          characterId: 'single-message',
          senderName: 'Unknown',
          messageText: text,
          messageType: 'chat',
          sessionFilePath: '',
          translationStatus: 'idle',
          translatedText: null,
          errorMessage: null
        }
      ],
      options
    )

    const translatedText = translations.get('single-message')
    if (!translatedText) {
      throw new Error('Translation response did not contain text')
    }

    return translatedText
  }
}

function buildBatchTranslationPrompt(config: AppConfig): string {
  const template = config.translationPrompt.trim() || DEFAULT_TRANSLATION_PROMPT
  const resolvedTemplate = /\{\{\s*targetLanguage\s*\}\}/u.test(template)
    ? template.replace(/\{\{\s*targetLanguage\s*\}\}/gu, config.targetLanguage)
    : `${template}\n\nTarget language: ${config.targetLanguage}`

  return [
    resolvedTemplate,
    'You will receive a JSON object with a messages array.',
    'Translate each messageText into the target language while preserving names and EVE-specific terms where appropriate.',
    'Return JSON only with this exact shape: {"translations":[{"messageId":"...","translatedText":"..."}]}.',
    'Include every input messageId exactly once and do not add extra fields.'
  ].join('\n\n')
}

function normalizeMessageContent(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text?.trim() ?? '')
    .join('\n')
    .trim()
}

function parseTranslationResponse(content: string): TranslationResponsePayload {
  const normalized = content.trim().replace(/^```json\s*/iu, '').replace(/^```\s*/iu, '').replace(/```$/u, '').trim()

  try {
    return JSON.parse(normalized) as TranslationResponsePayload
  } catch {
    const objectStart = normalized.indexOf('{')
    const objectEnd = normalized.lastIndexOf('}')

    if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
      throw new Error('Translation response was not valid JSON')
    }

    return JSON.parse(normalized.slice(objectStart, objectEnd + 1)) as TranslationResponsePayload
  }
}