import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { DirectoryStatus } from '../../shared/types'

export class EvePathResolver {
  constructor(private readonly documentsDirectory: string) {}

  getDefaultLogDirectory(): string {
    return join(this.documentsDirectory, 'EVE', 'logs', 'Chatlogs')
  }

  resolveDirectory(manualDirectory: string | null): DirectoryStatus {
    const targetPath = manualDirectory?.trim() || this.getDefaultLogDirectory()
    const exists = existsSync(targetPath)

    return {
      path: targetPath,
      exists,
      source: manualDirectory?.trim() ? 'manual' : exists ? 'default' : 'missing',
      errorMessage: exists ? null : 'Chatlogs directory was not found. Pick the EVE Chatlogs folder manually.'
    }
  }
}