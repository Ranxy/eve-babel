import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { DoubleArrayTrie } from './doubleArrayTrie'

// ── Types ───────────────────────────────────────────────────────────

export interface MatchedTerm {
  /** The keyID from the CSV. */
  keyId: number
  /** The original English term (preserved case from CSV). */
  sourceText: string
  /** The actual substring matched in the original text (may be in any language). */
  matchedText: string
  /** The translation in the target language (empty string if unavailable). */
  translatedText: string
}

interface LookupEntry {
  id: number
  en: string
  [lang: string]: string | number
}

// ── Language mapping: CSV code → App target language ────────────────

/**
 * Map a short CSV language code to the corresponding app target language.
 * Returns null if the language is not supported as a translation target.
 */
const CSV_TO_APP_TARGET: Record<string, string | null> = {
  en: 'en-US',     // English CAN be a target (e.g. translating from Chinese to English)
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  de: 'de-DE',
  fr: 'fr-FR',
  ru: 'ru-RU',
  es: null,        // Spanish not in app targets
  it: null          // Italian not in app targets
}

/**
 * Map an app target language (e.g. "zh-CN", "zh-TW") to the CSV language code
 * that should be used for lookups.
 */
function appTargetToCsvLang(appTarget: string): string | null {
  // Exact match first (e.g. "zh-CN" → "zh"? No, check CSV_TO_APP_TARGET reverse)
  for (const [csvCode, appCode] of Object.entries(CSV_TO_APP_TARGET)) {
    if (appCode === appTarget) return csvCode
  }

  // Fallback: base language (e.g. "zh-TW" → "zh")
  const base = appTarget.split('-')[0]
  if (base && base !== appTarget) {
    for (const [csvCode, appCode] of Object.entries(CSV_TO_APP_TARGET)) {
      if (appCode?.startsWith(base)) return csvCode
    }
  }

  return null
}

// ── TermMatcher ─────────────────────────────────────────────────────

export class TermMatcher {
  private trie: DoubleArrayTrie | null = null
  private lookup: Map<number, LookupEntry> | null = null

  /**
   * Load preprocessed files from a directory.
   * Returns true on success, false if files are missing or corrupted.
   */
  async load(dataDir: string): Promise<boolean> {
    try {
      const datPath = join(dataDir, 'terms.dat')
      const jsonPath = join(dataDir, 'terms.json')

      const [datBuffer, jsonText] = await Promise.all([
        readFile(datPath),
        readFile(jsonPath, 'utf-8')
      ])

      const trie = DoubleArrayTrie.deserialize(datBuffer)
      if (!trie) {
        console.warn('[TermMatcher] Failed to deserialize terms.dat')
        return false
      }

      const lookupArray = JSON.parse(jsonText) as LookupEntry[]
      const lookup = new Map<number, LookupEntry>()
      for (const entry of lookupArray) {
        lookup.set(entry.id, entry)
      }

      this.trie = trie
      this.lookup = lookup
      return true
    } catch (err) {
      console.warn('[TermMatcher] Load failed:', (err as Error).message)
      return false
    }
  }

  /** Whether the matcher has been loaded successfully. */
  get isLoaded(): boolean {
    return this.trie !== null && this.lookup !== null
  }

  /**
   * Find EVE terms in the given text and return their target-language translations.
   *
   * @param text        The chat message text (in English).
   * @param targetLang  The app target language (e.g. "zh-CN").
   * @param maxTerms    Maximum number of terms to return.
   * @returns Matched terms sorted by length descending (longer = more specific first).
   */
  findMatches(text: string, targetLang: string, maxTerms: number): MatchedTerm[] {
    if (!this.trie || !this.lookup) return []

    const csvLang = appTargetToCsvLang(targetLang)
    if (!csvLang) return [] // target language not supported by CSV

    const lowerText = text.toLowerCase()
    // Use raw (non-deduplicated) matches so that the same keyId can appear at
    // multiple positions. Containment filtering runs first; dedup by keyId happens
    // afterwards so that an occurrence subsumed by a longer match at position X
    // doesn't block a valid standalone occurrence at position Y.
    const trieMatches = this.trie.findAllMatchesRaw(lowerText)

    // Build intermediate list with positions and translation lookups
    interface PosMatch {
      start: number
      end: number       // start + length
      keyId: number
      sourceText: string
      translatedText: string
    }

    const posMatches: PosMatch[] = []
    for (const tm of trieMatches) {
      const entry = this.lookup.get(tm.value)
      if (!entry) continue

      const translatedText = (entry[csvLang] as string) ?? ''
      if (translatedText.length === 0) continue

      posMatches.push({
        start: tm.start,
        end: tm.start + tm.length,
        keyId: tm.value,
        sourceText: entry.en,
        translatedText
      })
    }

    // Step 1: sort by start ASC, end DESC so longer matches at the same
    // position are processed first and can subsume shorter ones.
    posMatches.sort((a, b) => a.start - b.start || b.end - a.end)

    // Step 2: filter out subsumed matches.
    // A match is subsumed if another kept match fully contains it.
    const unsubsumed: PosMatch[] = []
    for (const pm of posMatches) {
      let subsumed = false
      for (const k of unsubsumed) {
        if (k.start <= pm.start && k.end >= pm.end) {
          subsumed = true
          break
        }
      }
      if (!subsumed) {
        unsubsumed.push(pm)
      }
    }

    // Step 3: filter out matches that end mid-word.
    // Check the actual matched substring in the original text (not sourceText,
    // which may be in a different language than the matched term).
    // If the last char of the matched span is ASCII alphanumeric AND the
    // next char in the text is also ASCII alphanumeric, the match bleeds
    // into a neighbouring word (e.g. "Signal Distortion Amplifier I"
    // matching the "i" in "...Amplifier is").
    const notMidWord: PosMatch[] = []
    for (const pm of unsubsumed) {
      const lastChar = text.charAt(pm.end - 1)
      if (isAsciiAlphanumeric(lastChar)) {
        const nextChar = text.charAt(pm.end)
        if (isAsciiAlphanumeric(nextChar)) {
          continue // mid-word match — skip
        }
      }
      notMidWord.push(pm)
    }

    // Step 4: after containment + mid-word filter, deduplicate by keyId.
    // Keep the match with the longest sourceText among surviving occurrences.
    const byKeyId = new Map<number, PosMatch>()
    for (const pm of notMidWord) {
      const existing = byKeyId.get(pm.keyId)
      if (!existing || pm.sourceText.length > existing.sourceText.length) {
        byKeyId.set(pm.keyId, pm)
      }
    }

    // Step 5: deduplicate identical (sourceText, start, end) from different keyIds
    // (CSV may have the same English term under multiple keyIds).
    const byTextPos = new Map<string, PosMatch>()
    for (const pm of byKeyId.values()) {
      const dedupKey = `${pm.sourceText.toLowerCase()}|${pm.start}|${pm.end}`
      const existing = byTextPos.get(dedupKey)
      if (!existing || pm.translatedText.length > existing.translatedText.length) {
        byTextPos.set(dedupKey, pm)
      }
    }

    // Step 6: sort by sourceText length descending and cap
    const results: MatchedTerm[] = [...byTextPos.values()].map((pm) => ({
      keyId: pm.keyId,
      sourceText: pm.sourceText,
      matchedText: text.slice(pm.start, pm.end),
      translatedText: pm.translatedText
    }))
    results.sort((a, b) => b.sourceText.length - a.sourceText.length)
    return results.slice(0, maxTerms)
  }
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * True if `ch` is an ASCII letter or digit (A-Z, a-z, 0-9).
 * Used for mid-word detection: if a match ends with an ASCII alphanumeric
 * and the next char in the text is also ASCII alphanumeric, the match likely
 * bleeds into a neighbouring word (e.g. "I" matching the "i" in "is").
 * We deliberately exclude Unicode letters (CJK, Cyrillic, accented Latin)
 * because those scripts don't have the same false-positive problem — a
 * Chinese character matching another Chinese character is always intentional.
 */
function isAsciiAlphanumeric(ch: string): boolean {
  if (ch.length === 0) return false
  const c = ch.codePointAt(0)
  if (c === undefined) return false
  return (
    (c >= 0x30 && c <= 0x39) || // 0-9
    (c >= 0x41 && c <= 0x5a) || // A-Z
    (c >= 0x61 && c <= 0x7a)    // a-z
  )
}
