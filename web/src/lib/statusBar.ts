import { useEffect, useSyncExternalStore } from 'react'
import type { IconName } from '../ui/Icon/Icon'

type At = { x: number; y: number }

/**
 * One entry of the status bar at the bottom of the window, VS Code style. Any component can add
 * its own with `useStatusItem` (an action, a status, a menu): it shows while that component is
 * mounted and follows its renders.
 */
export type StatusItem = {
  /** Unique: a second item with the same id replaces the first. */
  id: string
  side: 'left' | 'right'
  /** Higher comes first within its side (leftmost on the left, rightmost on the right). */
  order?: number
  icon?: IconName
  text?: string
  title?: string
  tone?: 'normal' | 'busy' | 'good' | 'bad' | 'warn'
  /** `at` is the item's corner, to drop a menu from it. */
  onClick?: (at: At) => void
}

/** What the bar draws: the click goes through `clickStatusItem`, so handlers never redraw it. */
export type ShownItem = Omit<StatusItem, 'onClick'> & { clickable: boolean }

const items = new Map<string, ShownItem>()
const handlers = new Map<string, (at: At) => void>()
const listeners = new Set<() => void>()
let snapshot: ShownItem[] = []

function changed() {
  snapshot = [...items.values()]
  listeners.forEach((l) => l())
}

/** Shows `item` while the calling component is mounted; null hides it. */
export function useStatusItem(item: StatusItem | null) {
  const id = item?.id ?? null
  const { onClick, ...shown } = item ?? { id: '', side: 'left' as const }
  const key = item ? JSON.stringify({ ...shown, clickable: !!onClick }) : null
  useEffect(() => {
    if (!id) return
    if (onClick) handlers.set(id, onClick)
    else handlers.delete(id)
  })
  useEffect(() => {
    if (!id || !key) return
    items.set(id, JSON.parse(key) as ShownItem)
    changed()
  }, [id, key])
  useEffect(() => {
    if (!id) return
    return () => {
      items.delete(id)
      handlers.delete(id)
      changed()
    }
  }, [id])
}

export function clickStatusItem(id: string, at: At) {
  handlers.get(id)?.(at)
}

const subscribe = (on: () => void) => {
  listeners.add(on)
  return () => listeners.delete(on)
}

export function useStatusItems(): ShownItem[] {
  return useSyncExternalStore(subscribe, () => snapshot)
}
