import { useCallback } from 'react'
import { useSessionState } from '../../lib/useSessionState'
import type { DraftThread } from '../../protocol/github'

/** Inline comments written in the Files tab, sent together as one review. */
export function usePendingReview(prKey: string) {
  const [pending, setPending] = useSessionState<DraftThread[]>(`pr.pending.${prKey}`, [])
  const add = useCallback((t: DraftThread) => setPending([...pending, t]), [pending, setPending])
  const remove = useCallback((i: number) => setPending(pending.filter((_, j) => j !== i)), [pending, setPending])
  const clear = useCallback(() => setPending([]), [setPending])
  return { pending, add, remove, clear }
}

export type PendingReview = ReturnType<typeof usePendingReview>
