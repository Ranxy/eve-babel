import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { LlmDebugLogger } from './llmDebugLogger'

const tempDirectories: string[] = []

afterEach(async () => {
  while (tempDirectories.length > 0) {
    const directoryPath = tempDirectories.pop()
    if (directoryPath) {
      await rm(directoryPath, { recursive: true, force: true })
    }
  }
})

describe('LlmDebugLogger', () => {
  it('writes one JSON file per logged exchange', async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), 'eve-babel-llm-debug-'))
    tempDirectories.push(directoryPath)
    const logger = new LlmDebugLogger(directoryPath)

    await logger.logExchange({
      requestId: 'request-1',
      createdAt: '2026-05-20T14:05:00.000Z',
      request: {
        url: 'https://example.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer [redacted]'
        },
        body: { test: true }
      },
      response: {
        status: 200,
        ok: true,
        bodyText: '{"ok":true}',
        body: { ok: true }
      },
      error: null
    })

    const files = await readdir(directoryPath)
    expect(files).toHaveLength(1)

    const raw = await readFile(join(directoryPath, files[0]), 'utf8')
    expect(JSON.parse(raw)).toMatchObject({
      requestId: 'request-1',
      request: {
        body: { test: true }
      },
      response: {
        status: 200,
        body: { ok: true }
      }
    })
  })
})