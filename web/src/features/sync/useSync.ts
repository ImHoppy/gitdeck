import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { RebaseAction, RepoResult, SyncKind, SyncOutcome } from '../../protocol/types'
import { loadPullAction, type PullAction, savePullAction } from './pullAction'
import { loadChoice, saveChoice, type SubmoduleChoice } from './submoduleChoice'

export type Summary = { title: string; results: RepoResult[] }

const FOCUS_FETCH_AFTER_SECS = 60

function failedResult(id: number, e: unknown): RepoResult {
  return { id, outcome: { kind: 'failed', message: (e as Error).message }, submodulesMoved: [] }
}

/** Asks the user something; resolves true on yes. */
type Confirm = (title: string, body: string, yes: string) => Promise<boolean>

/** `confirm`: offered after a rejected push, to pull (rebase) and push again. */
export function useSync(confirm?: Confirm) {
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set())
  const [bulk, setBulk] = useState<SyncKind | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [choice, setChoiceState] = useState<SubmoduleChoice>(loadChoice)
  const [moved, setMoved] = useState<RepoResult[]>([])
  const [pullAction, setPullActionState] = useState<PullAction>(loadPullAction)

  const setBusyFor = useCallback((id: number, on: boolean) => {
    setBusy((b) => {
      const next = new Set(b)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const updateSubmodules = useCallback(
    async (ids: number[]) => {
      const results = await Promise.all(
        ids.map(async (id) => {
          setBusyFor(id, true)
          try {
            const outcome = await gitd.call<SyncOutcome>('repo.updateSubmodules', { id })
            return { id, outcome, submodulesMoved: [] }
          } catch (e) {
            return failedResult(id, e)
          } finally {
            setBusyFor(id, false)
          }
        }),
      )
      setSummary({ title: 'submodule update', results })
    },
    [setBusyFor],
  )

  const finish = useCallback(
    (title: string, results: RepoResult[]) => {
      setSummary({ title, results })
      const withMoves = results.filter((r) => r.submodulesMoved.length > 0)
      if (withMoves.length === 0 || choice === 'never') return
      if (choice === 'always') void updateSubmodules(withMoves.map((r) => r.id))
      else setMoved(withMoves)
    },
    [choice, updateSubmodules],
  )

  const run = useCallback(
    async (id: number, kind: SyncKind): Promise<RepoResult> => {
      setBusyFor(id, true)
      try {
        return await gitd.call<RepoResult>('repo.sync', { id, kind })
      } catch (e) {
        return failedResult(id, e)
      } finally {
        setBusyFor(id, false)
      }
    },
    [setBusyFor],
  )

  const sync = useCallback(
    async (id: number, kind: SyncKind) => {
      const result = await run(id, kind)
      finish(kind, [result])
      if (kind !== 'push' || result.outcome.kind !== 'rejected' || !confirm) return
      const ok = await confirm(
        'Push rejected',
        'The remote has commits this branch does not have. Pull them (rebase, your changes kept aside), then push?',
        'Pull & push',
      )
      if (!ok) return
      const pulled = await run(id, 'pull')
      if (pulled.outcome.kind !== 'done' && pulled.outcome.kind !== 'upToDate') {
        // a conflict stops here, with continue / skip / abort as after any pull
        finish('pull', [pulled])
        return
      }
      finish('pull & push', [await run(id, 'push')])
    },
    [finish, run, confirm],
  )

  const syncAll = useCallback(
    async (kind: SyncKind) => {
      setBulk(kind)
      try {
        finish(`${kind} all`, await gitd.call<RepoResult[]>('repo.syncAll', { kind }))
      } catch (e) {
        setSummary({ title: `${kind} all failed: ${(e as Error).message}`, results: [] })
      }
      setBulk(null)
    },
    [finish],
  )

  const rebase = useCallback(
    async (id: number, action: RebaseAction) => {
      setBusyFor(id, true)
      let result: RepoResult
      try {
        const outcome = await gitd.call<SyncOutcome>('repo.rebase', { id, action })
        result = { id, outcome, submodulesMoved: [] }
      } catch (e) {
        result = failedResult(id, e)
      }
      setBusyFor(id, false)
      setSummary({ title: `rebase ${action}`, results: [result] })
    },
    [setBusyFor],
  )

  const setChoice = useCallback((c: SubmoduleChoice) => {
    saveChoice(c)
    setChoiceState(c)
  }, [])

  const setPullAction = useCallback((a: PullAction) => {
    savePullAction(a)
    setPullActionState(a)
  }, [])

  const answerMoved = useCallback(
    (update: boolean, remember: boolean) => {
      if (remember) setChoice(update ? 'always' : 'never')
      if (update) void updateSubmodules(moved.map((r) => r.id))
      setMoved([])
    },
    [moved, setChoice, updateSubmodules],
  )

  useEffect(() => {
    const onFocus = () =>
      gitd.call('workspace.fetchStale', { olderThanSecs: FOCUS_FETCH_AFTER_SECS }).catch(() => {})
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const dismiss = useCallback(() => setSummary(null), [])

  return {
    busy,
    bulk,
    summary,
    sync,
    rebase,
    syncAll,
    dismiss,
    choice,
    setChoice,
    moved,
    answerMoved,
    pullAction,
    setPullAction,
  }
}
