import { useCallback, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { RepoAction, SyncOutcome } from '../../protocol/types'

export type CommandResult = { title: string; outcome: SyncOutcome }

export function useRepoCommands(repoId: number) {
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<CommandResult | null>(null)

  const run = useCallback(
    async (title: string, action: RepoAction): Promise<SyncOutcome> => {
      setBusy(true)
      let outcome: SyncOutcome
      try {
        outcome = await gitd.call<SyncOutcome>('cmd.run', { id: repoId, action })
      } catch (e) {
        outcome = { kind: 'failed', message: (e as Error).message }
      }
      setBusy(false)
      setLast({ title, outcome })
      return outcome
    },
    [repoId],
  )

  const clear = useCallback(() => setLast(null), [])
  return { busy, last, run, clear }
}
