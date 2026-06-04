/**
 * Preprocessing script: converts temp/translations.csv into
 * resources/terms.dat (Double-Array Trie) and resources/terms.json (lookup table).
 *
 * Usage: npx tsx scripts/build-translation-table.ts
 */

import { createReadStream, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { DoubleArrayTrie, type TrieBuildEntry } from '../src/main/services/doubleArrayTrie'

// ── Config ──────────────────────────────────────────────────────────

const CSV_PATH = join(import.meta.dirname, '..', 'resources', 'translations.csv')
const OUT_DIR = join(import.meta.dirname, '..', 'resources')
const DAT_PATH = join(OUT_DIR, 'terms.dat')
const JSON_PATH = join(OUT_DIR, 'terms.json')

// ── Types ───────────────────────────────────────────────────────────

interface TermEntry {
  id: number
  en: string
  [lang: string]: string | number  // dynamic language keys
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Reading CSV...')
  const { entries, termMap } = await parseCsv(CSV_PATH)

  console.log(`Parsed ${termMap.size} keyIDs from CSV`)

  // Build lookup table
  const lookup: TermEntry[] = []
  for (const [keyId, langMap] of termMap) {
    const entry: TermEntry = { id: keyId, en: langMap.get('en') ?? '' }
    for (const [lang, text] of langMap) {
      if (lang !== 'en' && text.length > 0) {
        entry[lang] = text
      }
    }
    // Only include terms that have English text
    if (entry.en.length > 0) {
      lookup.push(entry)
    }
  }

  console.log(`Lookup table: ${lookup.length} entries`)

  // Build DAT from ALL language terms (lowercased) so that terms can be
  // matched regardless of the source language of the chat message.
  const trieEntries: TrieBuildEntry[] = []
  const seenKeys = new Set<string>()
  for (const item of lookup) {
    for (const [lang, text] of Object.entries(item)) {
      if (lang === 'id') continue
      if (typeof text !== 'string' || text.length === 0) continue
      const key = text.toLowerCase()
      // Skip duplicate keys (rare: same text under different keyIds)
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      trieEntries.push({ key, value: item.id })
    }
  }

  console.log(`Building Double-Array Trie with ${trieEntries.length} keys...`)
  const trie = DoubleArrayTrie.build(trieEntries)
  console.log(`Trie built: ${trie.stateCount} states, ${trie.terminalCount} terminals`)

  // Serialize
  const datBuffer = trie.serialize()
  writeFileSync(DAT_PATH, datBuffer)
  console.log(`Wrote ${DAT_PATH} (${(datBuffer.length / 1024).toFixed(1)} KB)`)

  // Write lookup JSON
  const jsonContent = JSON.stringify(lookup)
  writeFileSync(JSON_PATH, jsonContent, 'utf-8')
  console.log(`Wrote ${JSON_PATH} (${(jsonContent.length / 1024).toFixed(1)} KB)`)

  console.log('Done.')
}

// ── CSV Parser ──────────────────────────────────────────────────────

async function parseCsv(csvPath: string): Promise<{
  entries: Map<string, number>           // lowercased English → keyID
  termMap: Map<number, Map<string, string>>  // keyID → language → text
}> {
  const termMap = new Map<number, Map<string, string>>()

  const stream = createReadStream(csvPath, { encoding: 'utf-8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  let lineNum = 0
  for await (const line of rl) {
    lineNum++
    if (lineNum === 1) continue // skip header

    const parsed = parseCsvLine(line)
    if (!parsed) continue

    const { keyID, lang, text } = parsed
    if (text.length === 0) continue

    let langMap = termMap.get(keyID)
    if (!langMap) {
      langMap = new Map()
      termMap.set(keyID, langMap)
    }

    // If there are multiple texts for the same keyID+lang, keep the first
    if (!langMap.has(lang)) {
      langMap.set(lang, text)
    }
  }

  return { entries: new Map(), termMap }
}

/**
 * Parse a single CSV line:  keyID,languageID,text
 * The text field may be quoted and may contain commas and escaped quotes.
 */
function parseCsvLine(line: string): { keyID: number; lang: string; text: string } | null {
  // Match: digits, comma, 2-char lang code, comma, (possibly quoted) text
  // We use a simple state-machine approach for robustness.
  let pos = 0

  // Parse keyID
  const keyIdEnd = line.indexOf(',', pos)
  if (keyIdEnd === -1) return null
  const keyID = parseInt(line.slice(pos, keyIdEnd), 10)
  if (isNaN(keyID)) return null
  pos = keyIdEnd + 1

  // Parse languageID (2 chars)
  const langEnd = line.indexOf(',', pos)
  if (langEnd === -1) return null
  const lang = line.slice(pos, langEnd).trim()
  if (lang.length === 0) return null
  pos = langEnd + 1

  // Parse text (rest of line; may be quoted)
  let text = line.slice(pos)
  if (text.startsWith('"') && text.endsWith('"')) {
    // Strip surrounding quotes and unescape double-quotes
    text = text.slice(1, -1).replace(/""/g, '"')
  }

  return { keyID, lang, text }
}

// ── Run ─────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
