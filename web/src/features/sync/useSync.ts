import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { RebaseAction, RepoResult, SyncKind, SyncOutcome } from '../../protocol/types'

export type Summary = { title: string; results: RepoResult[] }

const FOCUS_FETCH_AFTER_SECS = 60

export function useSync() {
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set())
  const [bulk, setBulk] = useState<SyncKind | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  const track = useCallback(async (id: number, title: string, call: () => Promise<SyncOutcome>) => {
    setBusy((b) => new Set(b).add(id))
    let outcome: SyncOutcome
    try {
      outcome = await call()
    } catch (e) {
      outcome = { kind: 'failed', message: (e as Error).message }
    }
    setSummary({ title, results: [{ id, outcome }] })
    setBusy((b) => {
      const next = new Set(b)
      next.delete(id)
      return next
    })
  }, [])

  const sync = useCallback(
    (id: number, kind: SyncKind) => track(id, kind, () => gitd.call<SyncOutcome>('repo.sync', { id, kind })),
    [track],
  )

  const rebase = useCallback(
    (id: number, action: RebaseAction) =>
      track(id, `rebase ${action}`, () => gitd.call<SyncOutcome>('repo.rebase', { id, action })),
    [track],
  )

  const syncAll = useCallback(async (kind: SyncKind) => {
    setBulk(kind)
    try {
      setSummary({ title: `${kind} all`, results: await gitd.call<RepoResult[]>('repo.syncAll', { kind }) })
    } catch (e) {
      setSummary({ title: `${kind} all failed: ${(e as Error).message}`, results: [] })
    }
    setBulk(null)
  }, [])

  useEffect(() => {
    const onFocus = () =>
      gitd.call('workspace.fetchStale', { olderThanSecs: FOCUS_FETCH_AFTER_SECS }).catch(() => {})
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const dismiss = useCallback(() => setSummary(null), [])

  return { busy, bulk, summary, sync, rebase, syncAll, dismiss }
}
