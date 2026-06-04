import { randomUUID } from 'node:crypto'

import { DEFAULT_TRANSLATION_PROMPT, type AppConfig, type ChatMessage } from '../../shared/types'
import type { LlmDebugLogEntry } from './llmDebugLogger'
import { LlmDebugLogger } from './llmDebugLogger'
import type { MatchedTerm } from './termMatcher'
import { TermMatcher } from './termMatcher'

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
  constructor(
    private readonly debugLogger: LlmDebugLogger | null = null,
    private readonly termMatcher: TermMatcher | null = null
  ) {}

  async translateMessages(messages: ChatMessage[], options: LlmClientOptions): Promise<Map<string, string>> {
    if (messages.length === 0) {
      return new Map()
    }

    const requestId = randomUUID()
    const requestUrl = `${options.config.apiBaseUrl.replace(/\/$/u, '')}/chat/completions`

    // Collect auto-detected EVE terms from all messages in the batch
    const autoTerms = this.collectAutoTerms(messages, options.config)

    const requestBody = {
      model: options.config.modelName,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: buildBatchTranslationPrompt(options.config, autoTerms)
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
    }

    let responseStatus: number | null = null
    let responseOk: boolean | null = null
    let responseBodyText: string | null = null
    let responseBody: unknown = null
    let requestError: Error | null = null

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      responseStatus = response.status
      responseOk = response.ok
      responseBodyText = await response.text()
      responseBody = parseJsonSafely(responseBodyText)

      if (!response.ok) {
        throw new Error(`Translation request failed with ${response.status}`)
      }

      const payload = responseBody as {
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
    } catch (error) {
      requestError = error instanceof Error ? error : new Error('Unknown translation error')
      throw requestError
    } finally {
      await this.writeDebugLogIfEnabled(options.config, {
        requestId,
        createdAt: new Date().toISOString(),
        request: {
          url: requestUrl,
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer [redacted]'
          },
          body: requestBody
        },
        response: {
          status: responseStatus,
          ok: responseOk,
          bodyText: responseBodyText,
          body: responseBody
        },
        error: requestError ? { message: requestError.message } : null
      })
    }
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

  /**
   * Collect auto-detected EVE terms from the batch of messages.
   * Returns an empty array if the term matcher is not loaded or the feature is disabled.
   */
  private collectAutoTerms(messages: ChatMessage[], config: AppConfig): MatchedTerm[] {
    if (!this.termMatcher || !config.autoGlossaryEnabled) {
      return []
    }

    const maxTerms = config.autoGlossaryMaxTerms ?? 30
    const seen = new Map<number, MatchedTerm>()

    for (const message of messages) {
      const matches = this.termMatcher.findMatches(message.messageText, config.targetLanguage, maxTerms)
      for (const match of matches) {
        if (!seen.has(match.keyId)) {
          seen.set(match.keyId, match)
        }
      }
    }

    // Sort by sourceText length descending, then cap
    const results = [...seen.values()]
    results.sort((a, b) => b.sourceText.length - a.sourceText.length)
    return results.slice(0, maxTerms)
  }

  private async writeDebugLogIfEnabled(config: AppConfig, entry: LlmDebugLogEntry): Promise<void> {
    if (!config.llmDebugEnabled || !this.debugLogger) {
      return
    }

    await this.debugLogger.logExchange(entry)
  }
}

function buildBatchTranslationPrompt(config: AppConfig, autoTerms: MatchedTerm[]): string {
  const template = config.translationPrompt.trim() || DEFAULT_TRANSLATION_PROMPT
  const resolvedTemplate = /\{\{\s*targetLanguage\s*\}\}/u.test(template)
    ? template.replace(/\{\{\s*targetLanguage\s*\}\}/gu, config.targetLanguage)
    : `${template}\n\nTarget language: ${config.targetLanguage}`

  const baseSegments = [
    resolvedTemplate,
    'You will receive a JSON object with a messages array.',
    'Translate each messageText into the target language while preserving names and EVE-specific terms where appropriate.',
    'Return JSON only with this exact shape: {"translations":[{"messageId":"...","translatedText":"..."}]}.',
    'Include every input messageId exactly once and do not add extra fields.'
  ]

  // Auto-detected EVE terms (from the translation table CSV)
  if (autoTerms.length > 0) {
    baseSegments.push(buildAutoGlossarySegment(autoTerms, config.targetLanguage))
  }

  // User-managed glossary (appended after auto terms so it takes precedence)
  const glossarySegment = buildGlossaryPromptSegment(config.glossary ?? [], config.targetLanguage)
  if (glossarySegment) {
    baseSegments.push(glossarySegment)
  }

  return baseSegments.join('\n\n')
}

/**
 * Build a prompt segment listing auto-detected terms and their translations.
 */
function buildAutoGlossarySegment(terms: MatchedTerm[], targetLanguage: string): string {
  // Filter out entries where matchedText == translatedText (same language — no value to the LLM)
  const useful = terms.filter((t) => t.matchedText.toLowerCase() !== t.translatedText.toLowerCase())

  if (useful.length === 0) return ''

  const lines = [
    `### Auto-detected EVE Terms (target: ${targetLanguage})`,
    'The following EVE-specific terms were detected in the chat messages below.',
    'When translating, use the target-language form shown for each term.',
    ''
  ]

  for (const term of useful) {
    // matchedText = the actual substring from the chat (could be Chinese, English, etc.)
    // translatedText = the translation in the target language
    lines.push(`- \`${term.matchedText}\` → ${term.translatedText}`)
  }

  return lines.join('\n')
}

function buildGlossaryPromptSegment(glossary: Array<{ terms: Record<string, string[]>; notes?: string }>, targetLanguage: string): string | null {
  const relevantEntries = glossary
    .filter((entry) => {
      const targets = entry.terms[targetLanguage]
      return Array.isArray(targets) && targets.some((v) => v.trim().length > 0)
    })

  if (relevantEntries.length === 0) {
    return null
  }

  const lines: string[] = [
    `## Game Terminology Glossary (target: ${targetLanguage})`,
    'Each group below represents the same EVE term expressed in different languages. Multiple variants per language are separated by commas.',
    'When translating chat messages into the target language, always use one of the target-language forms shown for these terms.',
    ''
  ]

  for (const entry of relevantEntries) {
    const langs = Object.keys(entry.terms).sort((a, b) => {
      if (a === targetLanguage) return 1
      if (b === targetLanguage) return -1
      return a.localeCompare(b)
    })

    const termLines = langs.map((lang) => {
      const variants = (entry.terms[lang] ?? []).filter((v) => v.trim().length > 0)
      if (variants.length === 0) return null
      const marker = lang === targetLanguage ? '→' : ' '
      return `  ${marker} ${lang}: ${variants.join(', ')}`
    }).filter((line): line is string => line !== null)

    if (termLines.length === 0) continue

    const note = entry.notes?.trim()
    if (note) {
      lines.push(`**${note}**`)
    }
    lines.push(...termLines)
    lines.push('')
  }

  return lines.join('\n')
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

function parseJsonSafely(value: string | null): unknown {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}
