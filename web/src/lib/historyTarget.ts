import { useEffect } from 'react'

/** A commit or branch to select in a repo's history, asked from elsewhere (a PR link). */
export type HistoryTarget = { repoId: number; rev: string }

const EVENT = 'gitdeck:history-target'
let pending: HistoryTarget | null = null

export function requestHistory(target: HistoryTarget) {
  pending = target
  window.dispatchEvent(new Event(EVENT))
}

/** Hands `onTarget` each request for `repoId`, including one made before the history was shown. */
export function useHistoryRequest(repoId: number, onTarget: (rev: string) => void) {
  useEffect(() => {
    const take = () => {
      if (pending?.repoId !== repoId) return
      const { rev } = pending
      pending = null
      onTarget(rev)
    }
    take()
    window.addEventListener(EVENT, take)
    return () => window.removeEventListener(EVENT, take)
  }, [repoId, onTarget])
}
