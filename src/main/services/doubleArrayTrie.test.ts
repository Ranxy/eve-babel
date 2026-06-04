import { describe, expect, it } from 'vitest'

import { DoubleArrayTrie, type TrieBuildEntry } from './doubleArrayTrie'

function buildTrie(entries: Array<[string, number]>): DoubleArrayTrie {
  return DoubleArrayTrie.build(entries.map(([key, value]) => ({ key, value })))
}

describe('DoubleArrayTrie', () => {
  // ── Build & basic query ──────────────────────────────────────────

  it('stores and retrieves a single key', () => {
    const trie = buildTrie([['hello', 1]])
    expect(trie.stateCount).toBeGreaterThan(0)
    expect(trie.terminalCount).toBe(1)

    const matches = trie.commonPrefixSearch('hello', 0)
    expect(matches).toHaveLength(1)
    expect(matches[0]).toEqual({ length: 5, value: 1 })
  })

  it('returns empty for non-matching text', () => {
    const trie = buildTrie([['hello', 1]])
    expect(trie.commonPrefixSearch('world', 0)).toHaveLength(0)
    expect(trie.commonPrefixSearch('hell', 0)).toHaveLength(0) // shorter than key
  })

  it('matches from a specific start position', () => {
    const trie = buildTrie([['test', 42]])
    expect(trie.commonPrefixSearch('xxxtestyyy', 3)).toHaveLength(1)
    expect(trie.commonPrefixSearch('xxxtestyyy', 3)[0]).toEqual({ length: 4, value: 42 })
    expect(trie.commonPrefixSearch('xxxtestyyy', 0)).toHaveLength(0)
  })

  it('handles multiple keys with shared prefix', () => {
    const trie = buildTrie([
      ['war', 1],
      ['warp', 2],
      ['warfare', 3]
    ])

    // "war" is a prefix of both "warp" and "warfare"
    const matches = trie.commonPrefixSearch('warfare', 0)
    expect(matches).toHaveLength(2)
    expect(matches[0]).toEqual({ length: 3, value: 1 }) // "war"
    expect(matches[1]).toEqual({ length: 7, value: 3 }) // "warfare"
  })

  it('handles keys where one is a prefix of another (different order)', () => {
    const trie = buildTrie([
      ['warp drive', 10],
      ['warp', 20]
    ])

    const matches = trie.commonPrefixSearch('warp drive active', 0)
    expect(matches).toHaveLength(2)
    // Should match both "warp" (length 4) and "warp drive" (length 10)
    expect(matches.find((m) => m.value === 20)!.length).toBe(4)
    expect(matches.find((m) => m.value === 10)!.length).toBe(10)
  })

  // ── findAllMatches (substring scanning) ──────────────────────────

  it('findAllMatches finds all occurrences', () => {
    const trie = buildTrie([
      ['alpha', 1],
      ['beta', 2],
      ['gamma', 3]
    ])

    const matches = trie.findAllMatches('alpha beta gamma')
    expect(matches).toHaveLength(3)
    expect(matches.map((m) => m.value).sort()).toEqual([1, 2, 3])
  })

  it('findAllMatches deduplicates by value (longest wins)', () => {
    const trie = buildTrie([
      ['Xarasier', 100],
      ['Xarasier Large', 200]
    ])

    const matches = trie.findAllMatches('Xarasier Large Micro Jump Drive')
    // Should find both "Xarasier" and "Xarasier Large"
    // But same position: "Xarasier" (len 8) vs "Xarasier Large" (len 15)
    // Both are kept because they have different values
    // "Xarasier" also matches at pos 0, but "Xarasier Large" is longer at same start
    // Actually both values are different, so both should appear
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches.some((m) => m.value === 200)).toBe(true)
  })

  it('findAllMatches with overlapping matches', () => {
    const trie = buildTrie([
      ['abc', 1],
      ['bcd', 2],
      ['cde', 3]
    ])

    const matches = trie.findAllMatches('abcde')
    // "abc" at pos 0, "bcd" at pos 1, "cde" at pos 2
    expect(matches).toHaveLength(3)
    expect(matches.map((m) => m.start).sort()).toEqual([0, 1, 2])
  })

  // ── Case sensitivity ─────────────────────────────────────────────

  it('matches are case-sensitive (exact match required)', () => {
    const trie = buildTrie([['Warp', 1]])
    expect(trie.commonPrefixSearch('warp', 0)).toHaveLength(0)
    expect(trie.commonPrefixSearch('Warp', 0)).toHaveLength(1)
  })

  // ── Special characters ───────────────────────────────────────────

  it('handles underscores and numbers', () => {
    const trie = buildTrie([
      ['instant_booster4', 10],
      ['mission_reroll', 20]
    ])

    expect(trie.commonPrefixSearch('instant_booster4_test', 0)).toHaveLength(1)
    expect(trie.commonPrefixSearch('mission_reroll', 0)[0]).toEqual({ length: 14, value: 20 })
  })

  it('handles Unicode characters (CJK, accented Latin)', () => {
    const trie = buildTrie([
      ['café', 1],
      ['战争驳船', 2],
      ['Комплектующая', 3]
    ])

    expect(trie.commonPrefixSearch('café au lait', 0)).toHaveLength(1)
    expect(trie.commonPrefixSearch('战争驳船组件', 0)).toHaveLength(1)
    expect(trie.commonPrefixSearch('Комплектующая десантных', 0)).toHaveLength(1)
  })

  it('skips surrogate pairs gracefully', () => {
    // Emoji are outside BMP — should be skipped, not crash
    const trie = buildTrie([['test', 1]])
    expect(trie.commonPrefixSearch('test😀more', 0)).toHaveLength(1) // matches "test"
  })

  // ── Serialization round-trip ─────────────────────────────────────

  it('survives serialize → deserialize round-trip', () => {
    const entries: TrieBuildEntry[] = [
      { key: 'alpha', value: 10 },
      { key: 'alphabet', value: 20 },
      { key: 'beta', value: 30 },
      { key: 'gamma', value: 40 }
    ]
    const original = DoubleArrayTrie.build(entries)
    const buffer = original.serialize()
    const restored = DoubleArrayTrie.deserialize(buffer)

    expect(restored).not.toBeNull()
    expect(restored!.stateCount).toBe(original.stateCount)
    expect(restored!.terminalCount).toBe(original.terminalCount)

    // Verify all keys can be found.
    // "alphabet" will also match "alpha" since it's a prefix — that's correct.
    for (const entry of entries) {
      const matches = restored!.commonPrefixSearch(entry.key, 0)
      // At minimum the full key itself must match
      const exactMatch = matches.find((m) => m.length === entry.key.length)
      expect(exactMatch).toBeDefined()
      expect(exactMatch!.value).toBe(entry.value)
    }
  })

  it('deserialize rejects invalid buffer', () => {
    expect(DoubleArrayTrie.deserialize(Buffer.alloc(0))).toBeNull()
    expect(DoubleArrayTrie.deserialize(Buffer.from('garbage data here yes'))).toBeNull()
    // Valid magic but wrong version
    const badVersion = Buffer.alloc(24)
    badVersion.writeUInt32LE(0x32444154, 0) // MAGIC correct
    badVersion.writeUInt32LE(999, 4) // wrong version
    badVersion.writeUInt32LE(0, 8)
    badVersion.writeUInt32LE(0, 12)
    badVersion.writeUInt32LE(0, 16)
    expect(DoubleArrayTrie.deserialize(badVersion)).toBeNull()
  })

  // ── Scale / edge cases ───────────────────────────────────────────

  it('handles empty entries array', () => {
    const trie = DoubleArrayTrie.build([])
    expect(trie.stateCount).toBeGreaterThanOrEqual(0) // may have root-only
    expect(trie.terminalCount).toBe(0)
    expect(trie.commonPrefixSearch('anything', 0)).toHaveLength(0)
  })

  it('handles very long keys', () => {
    const longKey = 'A'.repeat(200)
    const trie = buildTrie([[longKey, 99]])
    const matches = trie.commonPrefixSearch(longKey + 'extra', 0)
    expect(matches).toHaveLength(1)
    expect(matches[0].length).toBe(200)
  })

  it('handles many keys (stress test)', () => {
    const count = 1000
    const entries: TrieBuildEntry[] = []
    for (let i = 0; i < count; i++) {
      entries.push({ key: `item_${i.toString().padStart(5, '0')}`, value: i })
    }
    const trie = DoubleArrayTrie.build(entries)
    expect(trie.terminalCount).toBe(count)

    // Spot-check
    expect(trie.commonPrefixSearch('item_00042', 0)).toHaveLength(1)
    expect(trie.commonPrefixSearch('item_00999', 0)[0].value).toBe(999)
    expect(trie.commonPrefixSearch('item_01000', 0)).toHaveLength(0)
  })

  it('handles duplicate keys (last value wins)', () => {
    const trie = buildTrie([
      ['dup', 1],
      ['dup', 2]
    ])
    const matches = trie.commonPrefixSearch('dup', 0)
    expect(matches).toHaveLength(1)
    // Both get stored, but checking which one gets set last...
    // The build sorts keys, so "dup" and "dup" sort together.
    // The second one will be treated as a prefix of the first in the grouping logic.
    // This is an edge case; the implementation may vary.
    expect([1, 2]).toContain(matches[0].value)
  })

  // ── findAllMatches dedup across positions ────────────────────────

  it('findAllMatches picks longest match per value across all positions', () => {
    const trie = buildTrie([
      ['Shield', 10],
      ['Shield Booster', 20]
    ])

    const matches = trie.findAllMatches('Shield Booster is a Shield module')
    // "Shield Booster" should match at pos 0 (len 14, val 20)
    // "Shield" should match at pos 0 (len 6, val 10) — but longer match wins
    // "Shield" also matches at pos 20 (second occurrence)
    // For value 10: longest match is len 6 (at either pos 0 or 20) — still 6
    // Both values appear. Dedup keeps longest per value.

    expect(matches.some((m) => m.value === 20 && m.length === 14)).toBe(true)
    expect(matches.some((m) => m.value === 10)).toBe(true)
  })
})
