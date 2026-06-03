import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type WindowKind = 'main' | 'settings' | 'overlay'

export interface WindowStateSnapshot {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

type PersistedWindowState = Partial<Record<WindowKind, WindowStateSnapshot>>

export class WindowStateStore {
  private state: PersistedWindowState = {}

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      this.state = sanitizeWindowState(JSON.parse(raw) as unknown)
    } catch {
      this.state = {}
    }
  }

  getWindowState(kind: WindowKind): WindowStateSnapshot | null {
    const snapshot = this.state[kind]
    return snapshot ? { ...snapshot } : null
  }

  async updateWindowState(kind: WindowKind, snapshot: WindowStateSnapshot): Promise<void> {
    this.state = {
      ...this.state,
      [kind]: { ...snapshot }
    }
    await this.persist()
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2), 'utf8')
  }

  static createDefaultFilePath(userDataDirectory: string): string {
    return join(userDataDirectory, 'window-state.json')
  }
}

function sanitizeWindowState(input: unknown): PersistedWindowState {
  if (!input || typeof input !== 'object') {
    return {}
  }

  const state = input as Record<string, unknown>
  return {
    main: sanitizeSnapshot(state.main),
    settings: sanitizeSnapshot(state.settings),
    overlay: sanitizeSnapshot(state.overlay)
  }
}

function sanitizeSnapshot(input: unknown): WindowStateSnapshot | undefined {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const snapshot = input as Record<string, unknown>
  const width = typeof snapshot.width === 'number' && Number.isFinite(snapshot.width) ? snapshot.width : null
  const height = typeof snapshot.height === 'number' && Number.isFinite(snapshot.height) ? snapshot.height : null

  if (!width || !height) {
    return undefined
  }

  return {
    width,
    height,
    x: typeof snapshot.x === 'number' && Number.isFinite(snapshot.x) ? snapshot.x : undefined,
    y: typeof snapshot.y === 'number' && Number.isFinite(snapshot.y) ? snapshot.y : undefined,
    isMaximized: snapshot.isMaximized === true
  }
}