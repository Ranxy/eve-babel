import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en'
import ja from './locales/ja'
import ru from './locales/ru'
import zhCN from './locales/zh-CN'

/** All supported UI locales. Order determines display order in the switcher. */
export const SUPPORTED_LOCALES = [
  { code: 'en', nativeLabel: 'English' },
  { code: 'ja', nativeLabel: '日本語' },
  { code: 'ru', nativeLabel: 'Русский' },
  { code: 'zh-CN', nativeLabel: '简体中文' },
] as const

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

const LOCALE_STORAGE_KEY = 'eve-babel:locale'

function syncDocumentLanguage(code: SupportedLocaleCode): void {
  document.documentElement.lang = code
}

/**
 * Resolve the initial UI locale:
 * 1. Persisted user choice in localStorage
 * 2. Best match from navigator.languages / navigator.language
 * 3. English fallback
 */
function detectInitialLocale(): SupportedLocaleCode {
  const supported = SUPPORTED_LOCALES.map((l) => l.code)

  // 1. Persisted preference
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored && (supported as string[]).includes(stored)) {
    return stored as SupportedLocaleCode
  }

  // 2. Browser/system language list
  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  for (const lang of candidates) {
    // Exact match (e.g. 'zh-CN')
    if ((supported as string[]).includes(lang)) return lang as SupportedLocaleCode
    // Prefix match (e.g. 'zh' → 'zh-CN', 'en-US' → 'en')
    const prefix = lang.split('-')[0]
    const prefixMatch = SUPPORTED_LOCALES.find((l) => l.code === prefix || l.code.startsWith(prefix + '-'))
    if (prefixMatch) return prefixMatch.code
  }

  return 'en'
}

/** Change the active UI locale and persist the choice for future sessions. */
export function changeLocale(code: SupportedLocaleCode): void {
  void i18next.changeLanguage(code)
  localStorage.setItem(LOCALE_STORAGE_KEY, code)
  syncDocumentLanguage(code)
}

/**
 * i18next is initialised synchronously so that `t()` calls made during the
 * very first render (before any async loading) always return the correct
 * string.
 *
 * Interpolation delimiters are changed to [[ ]] to avoid collisions with the
 * {{targetLanguage}} placeholder that users type inside the translation-prompt
 * textarea.  All variable references in the locale files must use [[varName]].
 */
void i18next.use(initReactI18next).init({
  lng: detectInitialLocale(),
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    ja: { translation: ja },
    ru: { translation: ru },
    'zh-CN': { translation: zhCN },
  },
  interpolation: {
    escapeValue: false, // React handles XSS escaping
    prefix: '[[',
    suffix: ']]',
  },
  saveMissing: false,
})

syncDocumentLanguage((i18next.resolvedLanguage ?? i18next.language) as SupportedLocaleCode)

export default i18next
