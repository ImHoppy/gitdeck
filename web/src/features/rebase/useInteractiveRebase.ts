import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { SyncOutcome } from '../../protocol/types'

export type Step = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop'

export type PlannedCommit = { sha: string; subject: string; merge: boolean }

export type TodoItem = { sha: string; subject: string; step: Step; message: string }

/** The commits after `base` (oldest first) as an editable todo list, and running it. */
export function useInteractiveRebase(repoId: number, base: string) {
  const [todo, setTodo] = useState<TodoItem[] | null>(null)
  const [merges, setMerges] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    gitd.call<PlannedCommit[]>('rebase.plan', { id: repoId, base }).then(
      (plan) => {
        if (!live) return
        setMerges(plan.some((c) => c.merge))
        setTodo(plan.map((c) => ({ sha: c.sha, subject: c.subject, step: 'pick', message: c.subject })))
      },
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [repoId, base])

  /** True once the rebase ran (done, or stopped on a conflict to resolve); false with `error` set. */
  const run = useCallback(async (): Promise<boolean> => {
    if (!todo) return false
    setBusy(true)
    setError(null)
    try {
      const items = todo.map((t) => ({ sha: t.sha, step: t.step, message: t.step === 'reword' ? t.message : undefined }))
      const o = await gitd.call<SyncOutcome>('rebase.interactive', { id: repoId, base, todo: items })
      if (o.kind === 'done' || o.kind === 'conflict' || o.kind === 'autostashConflict') return true
      setError(o.kind === 'failed' ? o.message : o.kind === 'skipped' ? `Not started: ${o.reason}` : 'The rebase did not run')
      return false
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }, [repoId, base, todo])

  return { todo, setTodo, merges, error, busy, run }
}
