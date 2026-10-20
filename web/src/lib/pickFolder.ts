import { gitd } from '../protocol/client'

/** The native folder dialog of the machine gitd runs on; null when cancelled or unavailable. */
export function pickFolder(start = '', title?: string): Promise<string | null> {
  return gitd.call<string | null>('fs.pickFolder', { start: start.trim() || null, title }).catch(() => null)
}
