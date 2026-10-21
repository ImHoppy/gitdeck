import { useCallback, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { MergeMethod, Mutation, PrHead, StateChange, SwitchedFrom, SwitchOutcome } from '../../protocol/github'
import type { SyncOutcome } from '../../protocol/types'
import { targetParams, type PrTarget } from './usePullRequest'

export type ActionResult = { ok: boolean; text: string }

const describe = (o: SyncOutcome): string | null => {
  switch (o.kind) {
    case 'done':
    case 'upToDate':
      return null
    case 'skipped':
      return o.reason
    case 'failed':
      return o.message
    case 'authFailed':
      return 'authentication failed'
    default:
      return o.kind
  }
}

/** Every write on a PR: a job on gitd's queue; `onDone` reloads the PR after a success. */
export function usePrActions(target: PrTarget | null, number: number | null, onDone: () => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)

  const run = useCallback(
    async (label: string, method: string, params: object): Promise<boolean> => {
      if (!target || !number) return false
      setBusy(label)
      try {
        const outcome = await gitd.call<SyncOutcome>(method, { ...targetParams(target), number, ...params })
        const problem = describe(outcome)
        setResult(problem ? { ok: false, text: `${label}: ${problem}` } : { ok: true, text: `${label}: done` })
        if (!problem) onDone()
        return !problem
      } catch (e) {
        setResult({ ok: false, text: `${label}: ${(e as Error).message}` })
        return false
      } finally {
        setBusy(null)
      }
    },
    [target, number, onDone],
  )

  return {
    busy,
    result,
    clear: () => setResult(null),
    report: setResult,
    comment: (body: string, draft: string) => run('Comment', 'pr.comment', { body, draft }),
    edit: (title: string, body: string, draft: string) => run('Edit', 'pr.edit', { title, body, draft }),
    mutate: (label: string, mutation: Mutation) => run(label, 'pr.mutate', { mutation }),
    setState: (label: string, change: StateChange) => run(label, 'pr.state', { change }),
    merge: (method: MergeMethod, headSha: string, deleteBranch: string | null, localBranch: string | null, message: { subject: string; body: string } | null) =>
      run('Merge', 'pr.merge', { method, headSha, deleteBranch, localBranch, message }),
  }
}

/** "Switch to this branch" and back: plain git in the workspace clone. */
export function useSwitch(repoId: number | null) {
  const [from, setFrom] = useState<SwitchedFrom | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    if (repoId === null) return setFrom(null)
    gitd.call<SwitchedFrom | null>('pr.switchedFrom', { id: repoId }).then(setFrom, () => setFrom(null))
  }, [repoId])

  const switchTo = useCallback(
    async (pr: PrHead, remote: string, opts: { stash?: boolean; choice?: 'useExisting' | 'separate' } = {}): Promise<SwitchOutcome> => {
      setBusy(true)
      try {
        const request = { pr, remote, stash: !!opts.stash, choice: opts.choice ?? null }
        return await gitd.call<SwitchOutcome>('pr.switch', { id: repoId, request })
      } catch (e) {
        return { kind: 'failed', message: (e as Error).message }
      } finally {
        setBusy(false)
        refresh()
      }
    },
    [repoId, refresh],
  )

  const back = useCallback(async (): Promise<SyncOutcome> => {
    setBusy(true)
    try {
      return await gitd.call<SyncOutcome>('pr.switchBack', { id: repoId })
    } catch (e) {
      return { kind: 'failed', message: (e as Error).message }
    } finally {
      setBusy(false)
      refresh()
    }
  }, [repoId, refresh])

  return { from, busy, refresh, switchTo, back }
}
