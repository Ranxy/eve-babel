import type { EveBabelApi } from '../shared/types'

declare global {
  interface Window {
    eveBabel: EveBabelApi
  }
}

export {}