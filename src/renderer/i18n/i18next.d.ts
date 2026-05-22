/**
 * Augments the i18next module to enable full TypeScript type-checking on
 * translation keys and interpolation variables.
 *
 * See: https://www.i18next.com/overview/typescript
 */
import type { TranslationSchema } from './locales/en'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: TranslationSchema
    }
  }
}
