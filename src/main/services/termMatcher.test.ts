import { afterEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

import { DoubleArrayTrie, type TrieBuildEntry } from './doubleArrayTrie'
import { TermMatcher, type MatchedTerm } from './termMatcher'

function createTestFiles(entries: Array<{ id: number; en: string; zh: string; ja: string }>): string {
  const dir = join(tmpdir(), `term-matcher-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })

  // Build DAT from ALL language terms (matching the real build script)
  const seenKeys = new Set<string>()
  const trieEntries: TrieBuildEntry[] = []
  for (const e of entries) {
    const texts = [e.en, e.zh, e.ja]
    for (const text of texts) {
      if (text.length === 0) continue
      const key = text.toLowerCase()
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      trieEntries.push({ key, value: e.id })
    }
  }
  const trie = DoubleArrayTrie.build(trieEntries)
  writeFileSync(join(dir, 'terms.dat'), trie.serialize())

  // Write lookup JSON
  const lookup = entries.map((e) => ({ id: e.id, en: e.en, zh: e.zh, ja: e.ja }))
  writeFileSync(join(dir, 'terms.json'), JSON.stringify(lookup), 'utf-8')

  return dir
}

describe('TermMatcher', () => {
  let testDir: string | null = null

  afterEach(() => {
    if (testDir) {
      try { rmSync(testDir, { recursive: true }) } catch { /* ignore */ }
      testDir = null
    }
  })

  it('loads successfully from valid files', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'Warp', zh: '跃迁', ja: 'ワープ' }
    ])
    const matcher = new TermMatcher()
    const ok = await matcher.load(testDir)
    expect(ok).toBe(true)
    expect(matcher.isLoaded).toBe(true)
  })

  it('returns false when files are missing', async () => {
    const matcher = new TermMatcher()
    const ok = await matcher.load('/nonexistent/path')
    expect(ok).toBe(false)
    expect(matcher.isLoaded).toBe(false)
  })

  it('findMatches returns empty when not loaded', () => {
    const matcher = new TermMatcher()
    expect(matcher.findMatches('Warp Drive', 'zh-CN', 10)).toEqual([])
  })

  it('finds simple matches', async () => {
    testDir = createTestFiles([
      { id: 100, en: 'Warp Drive', zh: '跃迁引擎', ja: 'ワープドライブ' },
      { id: 200, en: 'Shield Booster', zh: '护盾回充增量器', ja: 'シールドブースター' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('Activate Warp Drive now!', 'zh-CN', 10)
    expect(matches).toHaveLength(1)
    expect(matches[0].sourceText).toBe('Warp Drive')
    expect(matches[0].translatedText).toBe('跃迁引擎')
  })

  it('matches case-insensitively', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'Warp Drive', zh: '跃迁引擎', ja: 'ワープドライブ' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('warp drive active', 'zh-CN', 10)
    expect(matches).toHaveLength(1)
    expect(matches[0].sourceText).toBe('Warp Drive')
  })

  it('returns multiple matches sorted by length descending', async () => {
    testDir = createTestFiles([
      { id: 10, en: 'Shield', zh: '护盾', ja: 'シールド' },
      { id: 20, en: 'Shield Booster', zh: '护盾回充增量器', ja: 'シールドブースター' },
      { id: 30, en: 'Armor', zh: '装甲', ja: 'アーマー' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('Shield Booster and Armor Repair', 'zh-CN', 10)
    expect(matches.length).toBeGreaterThanOrEqual(2)
    // Longest match first
    expect(matches[0].sourceText).toBe('Shield Booster')
  })

  it('deduplicates by keyId (keeps longest match per keyId)', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'Warp', zh: '跃迁', ja: 'ワープ' },
      { id: 2, en: 'Warp Drive', zh: '跃迁引擎', ja: 'ワープドライブ' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('Warp Drive', 'zh-CN', 10)
    // Both "Warp" and "Warp Drive" match, but they have different keyIds.
    // So both should appear (not deduplicated — dedup is BY keyId).
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches.some((m) => m.sourceText === 'Warp Drive')).toBe(true)
  })

  it('respects maxTerms limit', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'Alpha', zh: '阿尔法', ja: 'アルファ' },
      { id: 2, en: 'Beta', zh: '贝塔', ja: 'ベータ' },
      { id: 3, en: 'Gamma', zh: '伽马', ja: 'ガンマ' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('Alpha Beta Gamma', 'zh-CN', 2)
    expect(matches).toHaveLength(2)
  })

  it('skips terms without translation in target language', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'TermA', zh: '术语A', ja: '用語A' },
      { id: 2, en: 'TermB', zh: '', ja: '用語B' }  // no Chinese
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('TermA TermB', 'zh-CN', 10)
    // TermB should be skipped (no zh translation)
    expect(matches).toHaveLength(1)
    expect(matches[0].sourceText).toBe('TermA')
  })

  it('maps target languages correctly', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'Warp', zh: '跃迁', ja: 'ワープ' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    // zh-CN → zh
    const zhMatches = matcher.findMatches('Warp', 'zh-CN', 10)
    expect(zhMatches).toHaveLength(1)
    expect(zhMatches[0].translatedText).toBe('跃迁')

    // zh-TW → zh (fallback)
    const twMatches = matcher.findMatches('Warp', 'zh-TW', 10)
    expect(twMatches).toHaveLength(1)
    expect(twMatches[0].translatedText).toBe('跃迁')

    // ja-JP → ja
    const jaMatches = matcher.findMatches('Warp', 'ja-JP', 10)
    expect(jaMatches).toHaveLength(1)
    expect(jaMatches[0].translatedText).toBe('ワープ')

    // Unsupported language
    const esMatches = matcher.findMatches('Warp', 'es-ES', 10)
    expect(esMatches).toHaveLength(0)
  })

  it('returns empty for unsupported target language', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'Warp', zh: '跃迁', ja: 'ワープ' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    // 'it-IT' is not in CSV_TO_APP_TARGET
    expect(matcher.findMatches('Warp', 'it-IT', 10)).toEqual([])
  })

  it('filters out subsumed matches (shorter term fully contained in longer)', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'Hypnos Compact Signal Distortion Amplifier I', zh: '希普诺斯紧凑型信号失真放大器 I', ja: 'ヒュプノス…' },
      { id: 2, en: 'Signal Distortion Amplifier I', zh: '信号失真放大器 I', ja: 'シグナル…' },
      { id: 3, en: 'Amplifier', zh: '放大器', ja: 'アンプ' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('Hypnos Compact Signal Distortion Amplifier I', 'zh-CN', 10)
    // "Amplifier" is fully contained in "Signal Distortion Amplifier I",
    // which is fully contained in "Hypnos Compact Signal Distortion Amplifier I".
    // Only the longest should remain.
    expect(matches).toHaveLength(1)
    expect(matches[0].keyId).toBe(1)
    expect(matches[0].sourceText).toBe('Hypnos Compact Signal Distortion Amplifier I')
  })

  it('filters "Signal Distortion Amplifier I" when "Signal Distortion Amplifier II" matches', async () => {
    // "Signal Distortion Amplifier I" is a prefix/substring of "Signal Distortion Amplifier II"
    testDir = createTestFiles([
      { id: 10, en: 'Signal Distortion Amplifier I', zh: '信号失真放大器 I', ja: 'SDA-I' },
      { id: 20, en: 'Signal Distortion Amplifier II', zh: '信号失真放大器 II', ja: 'SDA-II' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('Signal Distortion Amplifier II', 'zh-CN', 10)

    // Only II should survive; I is fully contained (start=0 end=32 vs start=0 end=33)
    expect(matches).toHaveLength(1)
    expect(matches[0].keyId).toBe(20)
  })

  it('filters "Signal Distortion Amplifier I" when text has "… II" (case insensitive)', async () => {
    testDir = createTestFiles([
      { id: 10, en: 'Signal Distortion Amplifier I', zh: '信号失真放大器 I', ja: 'SDA-I' },
      { id: 20, en: 'Signal Distortion Amplifier II', zh: '信号失真放大器 II', ja: 'SDA-II' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    // Lowercase input — DAT stores lowercase keys
    const matches = matcher.findMatches('signal distortion amplifier ii', 'zh-CN', 10)
    expect(matches).toHaveLength(1)
    expect(matches[0].keyId).toBe(20)
  })

  it('deduplicates identical sourceText from different keyIds', async () => {
    // Simulate CSV having duplicate English terms under different keyIds
    testDir = createTestFiles([
      { id: 100, en: 'Warp Drive', zh: '跃迁引擎', ja: 'WD-1' },
      { id: 200, en: 'Warp Drive', zh: '跃迁引擎', ja: 'WD-2' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('Activate Warp Drive', 'zh-CN', 10)
    // Both keyIds match the same text — should be deduplicated by sourceText
    expect(matches).toHaveLength(1)
    expect(matches[0].sourceText).toBe('Warp Drive')
  })

  it('handles two occurrences: "Dread Guristas …" and later "… II"', async () => {
    // The CSV has "Signal Distortion Amplifier I" (with Roman I), not a bare version.
    // "… I" is a prefix of "… II", so it matches inside "… II" and must be filtered.
    testDir = createTestFiles([
      { id: 1, en: 'Dread Guristas Signal Distortion Amplifier', zh: '恐惧古斯塔斯信号失真放大器', ja: 'DG-SDA' },
      { id: 2, en: 'Signal Distortion Amplifier I', zh: '信号失真放大器 I', ja: 'SDA-I' },
      { id: 3, en: 'Signal Distortion Amplifier II', zh: '信号失真放大器 II', ja: 'SDA-II' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const text = 'Dread Guristas Signal Distortion Amplifier is also good. but it cost too much, so we use Signal Distortion Amplifier II'
    const matches = matcher.findMatches(text, 'zh-CN', 10)

    // "… I" matches "…Amplifier is…" as a false positive (I=i in "is"),
    // and also matches inside "… II" as a prefix.
    // The mid-word filter removes the false positive; containment removes the prefix.
    // Only the two longest forms should survive.
    const ids = matches.map((m) => m.keyId).sort()
    expect(ids).toEqual([1, 3])
  })

  it('matches Chinese terms in Chinese text', async () => {
    testDir = createTestFiles([
      { id: 10, en: 'Omen', zh: '启示级', ja: 'オーメン' },
      { id: 20, en: 'Punisher', zh: '惩罚者级', ja: 'パニッシャー' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    // Chinese chat message → target English: translatedText should be the English name
    const matches = matcher.findMatches('启示级是一条好船', 'en-US', 10)
    expect(matches).toHaveLength(1)
    expect(matches[0].sourceText).toBe('Omen')
    expect(matches[0].translatedText).toBe('Omen')
  })

  it('matches Chinese terms surrounded by Chinese text (no mid-word false flag)', async () => {
    testDir = createTestFiles([
      { id: 10, en: 'Omen', zh: '启示级', ja: 'オーメン' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    // Chinese has no word boundaries — terms are adjacent characters
    const matches = matcher.findMatches('我开启示级去打仗', 'zh-CN', 10)
    expect(matches).toHaveLength(1)
    expect(matches[0].sourceText).toBe('Omen')
  })

  it('handles mixed Chinese-English text with parentheses and symbols', async () => {
    // Simulates a killmail line: "击杀：koishisama (启示级*)"
    testDir = createTestFiles([
      { id: 10, en: 'Omen', zh: '启示级', ja: 'オーメン' },
      { id: 20, en: 'Kill', zh: '击杀', ja: 'キル' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const text = '击杀：koishisama (启示级*)'
    const matches = matcher.findMatches(text, 'zh-CN', 10)

    // Both "启示级" (via Chinese match) and "击杀" (via Chinese match) should be found
    expect(matches.some(m => m.keyId === 10)).toBe(true)
    // "击杀" should also be found if it's in the CSV
    expect(matches.some(m => m.keyId === 20)).toBe(true)
  })

  it('keeps partially overlapping terms that are not fully contained', async () => {
    testDir = createTestFiles([
      { id: 1, en: 'Shield Booster', zh: '护盾回充增量器', ja: 'シールドブースター' },
      { id: 2, en: 'Booster Armor', zh: '增强装甲', ja: 'ブースターアーマー' }
    ])
    const matcher = new TermMatcher()
    await matcher.load(testDir)

    const matches = matcher.findMatches('Shield Booster Armor', 'zh-CN', 10)
    // "Shield Booster" at pos 0-13, "Booster Armor" at pos 7-19.
    // They overlap at "Booster" but neither fully contains the other.
    expect(matches).toHaveLength(2)
  })
})
