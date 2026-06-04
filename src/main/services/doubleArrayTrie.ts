/**
 * Double-Array Trie (DAT) — pure TypeScript implementation.
 *
 * Stores a set of string→value mappings and supports:
 *  - commonPrefixSearch(text, startPos): all keys that are prefixes of text[startPos..]
 *  - findAllMatches(text): all keys appearing anywhere in text (substring matching)
 *
 * Based on the algorithm from J. Aoe, "An Efficient Implementation of Trie Structures"
 * (Software—Practice & Experience, 1989).
 */

const ROOT = 0
const INITIAL_CAPACITY = 65536
const GROWTH_FACTOR = 2

// Magic bytes "DAT2" (version 2 of our serialization format)
const MAGIC = 0x32444154 // "DAT2" in little-endian
const VERSION = 2

export interface TrieMatch {
  /** Length of the matched key in characters. */
  length: number
  /** The value associated with the matched key. */
  value: number
}

export interface TrieBuildEntry {
  key: string
  value: number
}

export class DoubleArrayTrie {
  private base: Int32Array
  private check: Int32Array
  private terminal: Int32Array

  private constructor(base: Int32Array, check: Int32Array, terminal: Int32Array) {
    this.base = base
    this.check = check
    this.terminal = terminal
  }

  // ── Factory: build from entries ──────────────────────────────────

  /**
   * Build a DAT from a list of key-value entries.
   * Entries are sorted by key internally; the caller does not need to sort.
   */
  static build(entries: TrieBuildEntry[]): DoubleArrayTrie {
    const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key))

    const builder = new TrieBuilder(INITIAL_CAPACITY)

    buildRecursive(sorted, 0, sorted.length, 0, ROOT, builder)

    const maxState = builder.maxUsedState()
    return new DoubleArrayTrie(
      builder.base.slice(0, maxState + 1),
      builder.check.slice(0, maxState + 1),
      builder.terminal.slice(0, maxState + 1)
    )
  }

  // ── Query API ────────────────────────────────────────────────────

  /**
   * Find all keys that are prefixes of `text`, starting at position `startPos`.
   * Returns matches sorted by length (shortest first, naturally from the loop).
   */
  commonPrefixSearch(text: string, startPos: number): TrieMatch[] {
    const results: TrieMatch[] = []
    let s = ROOT

    for (let i = startPos; i < text.length; i++) {
      const code = charCode(text[i])
      if (code === 0) break

      const t = this.base[s] + code
      if (t < 0 || t >= this.check.length || this.check[t] !== s + 1) {
        break
      }
      s = t

      if (this.terminal[s] !== 0) {
        results.push({ length: i - startPos + 1, value: this.terminal[s] - 1 })
      }
    }

    return results
  }

  /**
   * Find all keys appearing as substrings anywhere in `text`.
   * Returns deduplicated matches (longest match wins per value),
   * sorted by start position ascending.
   */
  findAllMatches(text: string): Array<{ start: number; length: number; value: number }> {
    const seen = new Map<number, { start: number; length: number }>()

    for (let i = 0; i < text.length; i++) {
      const matches = this.commonPrefixSearch(text, i)
      for (const match of matches) {
        const existing = seen.get(match.value)
        if (!existing || match.length > existing.length) {
          seen.set(match.value, { start: i, length: match.length })
        }
      }
    }

    const results: Array<{ start: number; length: number; value: number }> = []
    for (const [value, { start, length }] of seen) {
      results.push({ start, length, value })
    }
    results.sort((a, b) => a.start - b.start || b.length - a.length)
    return results
  }

  /**
   * Like findAllMatches, but returns ALL matches without deduplication.
   * Multiple matches for the same keyId at different positions are all included.
   * Sorted by start position ascending, then length descending.
   */
  findAllMatchesRaw(text: string): Array<{ start: number; length: number; value: number }> {
    const results: Array<{ start: number; length: number; value: number }> = []

    for (let i = 0; i < text.length; i++) {
      const matches = this.commonPrefixSearch(text, i)
      for (const match of matches) {
        results.push({ start: i, length: match.length, value: match.value })
      }
    }

    results.sort((a, b) => a.start - b.start || b.length - a.length)
    return results
  }

  // ── Serialization ────────────────────────────────────────────────

  /**
   * Serialize to a Buffer.
   * Format (little-endian):
   *   [4] magic  = 0x32444154 ("DAT2")
   *   [4] version
   *   [4] baseLength     (Int32 elements)
   *   [4] checkLength
   *   [4] terminalLength
   *   [baseLength * 4]   base array
   *   [checkLength * 4]  check array
   *   [terminalLength * 4] terminal array
   */
  serialize(): Buffer {
    const headerSize = 5 * 4
    const dataSize = (this.base.length + this.check.length + this.terminal.length) * 4
    const buf = Buffer.alloc(headerSize + dataSize)

    let offset = 0
    buf.writeUInt32LE(MAGIC, offset)
    offset += 4
    buf.writeUInt32LE(VERSION, offset)
    offset += 4
    buf.writeUInt32LE(this.base.length, offset)
    offset += 4
    buf.writeUInt32LE(this.check.length, offset)
    offset += 4
    buf.writeUInt32LE(this.terminal.length, offset)
    offset += 4

    writeInt32Array(buf, offset, this.base)
    offset += this.base.length * 4
    writeInt32Array(buf, offset, this.check)
    offset += this.check.length * 4
    writeInt32Array(buf, offset, this.terminal)

    return buf
  }

  /**
   * Deserialize from a Buffer previously produced by `serialize()`.
   * Returns null if the buffer is invalid or from an incompatible version.
   */
  static deserialize(buffer: Buffer): DoubleArrayTrie | null {
    if (buffer.length < 20) return null

    let offset = 0
    if (buffer.readUInt32LE(offset) !== MAGIC) return null
    offset += 4
    if (buffer.readUInt32LE(offset) !== VERSION) return null
    offset += 4

    const baseLen = buffer.readUInt32LE(offset)
    offset += 4
    const checkLen = buffer.readUInt32LE(offset)
    offset += 4
    const terminalLen = buffer.readUInt32LE(offset)
    offset += 4

    if (buffer.length < 20 + (baseLen + checkLen + terminalLen) * 4) return null

    const base = readInt32Array(buffer, offset, baseLen)
    offset += baseLen * 4
    const check = readInt32Array(buffer, offset, checkLen)
    offset += checkLen * 4
    const terminal = readInt32Array(buffer, offset, terminalLen)

    return new DoubleArrayTrie(base, check, terminal)
  }

  // ── Introspection ────────────────────────────────────────────────

  get stateCount(): number {
    return this.base.length
  }

  get terminalCount(): number {
    let count = 0
    for (const v of this.terminal) {
      if (v !== 0) count++
    }
    return count
  }
}

// ── Builder (mutable container for build-phase arrays) ─────────────

class TrieBuilder {
  base: Int32Array
  check: Int32Array
  terminal: Int32Array
  nextBaseHint = 1 // optimisation: start searching for free slots from here

  constructor(initialCapacity: number) {
    this.base = new Int32Array(initialCapacity)
    this.check = new Int32Array(initialCapacity)
    this.terminal = new Int32Array(initialCapacity)
  }

  ensureCapacity(t: number): void {
    if (t < this.base.length) return
    const newCap = Math.max(t + 1, this.base.length * GROWTH_FACTOR)
    this.base = growInt32Array(this.base, newCap)
    this.check = growInt32Array(this.check, newCap)
    this.terminal = growInt32Array(this.terminal, newCap)
  }

  maxUsedState(): number {
    for (let i = this.check.length - 1; i >= 0; i--) {
      if (this.check[i] !== 0) return i
    }
    return 0
  }
}

function growInt32Array(src: Int32Array, newCap: number): Int32Array {
  const dst = new Int32Array(newCap)
  dst.set(src)
  return dst
}

// ── Recursive build ────────────────────────────────────────────────

function buildRecursive(
  entries: TrieBuildEntry[],
  begin: number,
  end: number,
  depth: number,
  state: number,
  b: TrieBuilder
): void {
  // ── Single key ──────────────────────────────────────────────────
  if (begin + 1 === end) {
    const key = entries[begin].key

    // Key fully consumed → terminal at current state
    if (depth === key.length) {
      b.terminal[state] = entries[begin].value + 1 // +1: 0 reserved for non-terminal
      return
    }

    // Unique suffix: create chain of states
    let s = state
    for (let i = depth; i < key.length; i++) {
      const code = charCode(key[i])
      if (code === 0) break

      const baseVal = findBaseForCodes([code], b)
      b.base[s] = baseVal

      const t = baseVal + code
      b.ensureCapacity(t)
      b.check[t] = s + 1 // +1 offset: 0 means unused slot
      s = t
    }
    b.terminal[s] = entries[begin].value + 1 // +1: 0 reserved for non-terminal
    return
  }

  // ── Multiple keys — group by character at current depth ─────────
  const codes: number[] = []
  const groupStarts: number[] = []

  let prev = begin
  for (let i = begin; i < end; i++) {
    const key = entries[i].key

    // Key shorter than depth → it's a prefix of the remaining keys
    if (depth >= key.length) {
      b.terminal[state] = entries[i].value + 1 // +1: 0 reserved for non-terminal
      if (i === prev) prev = i + 1
      continue
    }

    if (i > prev && key[depth] !== entries[prev].key[depth]) {
      codes.push(charCode(entries[prev].key[depth]))
      groupStarts.push(prev)
      prev = i
    }
  }
  // Last group
  if (prev < end && depth < entries[prev].key.length) {
    codes.push(charCode(entries[prev].key[depth]))
    groupStarts.push(prev)
  }

  if (codes.length === 0) return

  const baseVal = findBaseForCodes(codes, b)
  b.base[state] = baseVal

  // Pre-allocate ALL child states first so that recursive builds
  // (which call findBaseForCodes) see them as occupied and don't collide.
  const childStates: number[] = []
  for (let g = 0; g < groupStarts.length; g++) {
    const code = charCode(entries[groupStarts[g]].key[depth])
    const childState = baseVal + code
    b.ensureCapacity(childState)
    b.check[childState] = state + 1 // +1 offset: 0 means unused slot
    childStates.push(childState)
  }

  for (let g = 0; g < groupStarts.length; g++) {
    const gBegin = groupStarts[g]
    const gEnd = g + 1 < groupStarts.length ? groupStarts[g + 1] : end
    buildRecursive(entries, gBegin, gEnd, depth + 1, childStates[g], b)
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function charCode(ch: string): number {
  const c = ch.codePointAt(0)
  if (c === undefined || c > 0xffff) return 0
  return c + 1 // 1-based; 0 reserved
}

/**
 * Find the smallest base ≥ b.nextBaseHint such that for every code ∈ codes,
 * position base + code has check == 0.
 * Updates b.nextBaseHint to the found base for future calls.
 */
function findBaseForCodes(codes: number[], b: TrieBuilder): number {
  let base = b.nextBaseHint
  outer: while (true) {
    for (const code of codes) {
      const t = base + code
      if (t < b.check.length && b.check[t] !== 0) {
        base++
        continue outer
      }
    }
    b.nextBaseHint = base
    return base
  }
}

function writeInt32Array(buf: Buffer, offset: number, arr: Int32Array): void {
  for (let i = 0; i < arr.length; i++) {
    buf.writeInt32LE(arr[i], offset + i * 4)
  }
}

function readInt32Array(buf: Buffer, offset: number, length: number): Int32Array {
  const arr = new Int32Array(length)
  for (let i = 0; i < length; i++) {
    arr[i] = buf.readInt32LE(offset + i * 4)
  }
  return arr
}
