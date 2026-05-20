import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface LlmDebugLogEntry {
  requestId: string
  createdAt: string
  request: {
    url: string
    headers: Record<string, string>
    body: unknown
  }
  response: {
    status: number | null
    ok: boolean | null
    bodyText: string | null
    body: unknown
  }
  error: {
    message: string
  } | null
}

export class LlmDebugLogger {
  constructor(private readonly directoryPath: string) {}

  async logExchange(entry: LlmDebugLogEntry): Promise<void> {
    await mkdir(this.directoryPath, { recursive: true })

    const safeTimestamp = entry.createdAt.replace(/[.:]/gu, '-').replace(/Z$/u, 'Z')
    const filePath = join(this.directoryPath, `${safeTimestamp}-${entry.requestId}.json`)

    await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8')
  }

  static createDefaultDirectory(userDataDirectory: string): string {
    return join(userDataDirectory, 'llm-debug')
  }
}