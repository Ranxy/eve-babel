import { DEFAULT_TRANSLATION_PROMPT, type AppConfig } from '../../shared/types'

interface LlmClientOptions {
  apiKey: string
  config: AppConfig
}

export class LlmClient {
  async translateText(text: string, options: LlmClientOptions): Promise<string> {
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
            content: buildTranslationPrompt(options.config)
          },
          {
            role: 'user',
            content: text
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Translation request failed with ${response.status}`)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const translatedText = payload.choices?.[0]?.message?.content?.trim()
    if (!translatedText) {
      throw new Error('Translation response did not contain text')
    }

    return translatedText
  }
}

function buildTranslationPrompt(config: AppConfig): string {
  const template = config.translationPrompt.trim() || DEFAULT_TRANSLATION_PROMPT

  if (/\{\{\s*targetLanguage\s*\}\}/u.test(template)) {
    return template.replace(/\{\{\s*targetLanguage\s*\}\}/gu, config.targetLanguage)
  }

  return `${template}\n\nTarget language: ${config.targetLanguage}\nReturn translation only.`
}