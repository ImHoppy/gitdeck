import { useCallback, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { RepoAction, SyncOutcome } from '../../protocol/types'

/** Workspace-tree actions that are not fetch/pull/push; failures land in `error`. */
export function useTreeCommands() {
  const [error, setError] = useState<string | null>(null)

  const call = useCallback(async (method: string, params: object) => {
    try {
      await gitd.call(method, params)
      setError(null)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }, [])

  const runAction = useCallback(
    async (id: number, action: RepoAction) => {
      const o = await gitd.call<SyncOutcome>('cmd.run', { id, action }).catch((e: Error) => ({ kind: 'failed' as const, message: e.message }))
      setError(o.kind === 'failed' ? o.message : o.kind === 'skipped' ? o.reason : null)
    },
    [],
  )

  return {
    error,
    clearError: () => setError(null),
    reveal: (id: number, what: 'explorer' | 'terminal') => call('repo.reveal', { id, with: what }),
    openInEditor: (id: number) => call('editor.open', { id }),
    checkoutTracked: (id: number) => call('repo.checkoutTracked', { id }),
    submodule: (id: number, op: 'init' | 'update') => call('repo.submodule', { id, op }),
    recordPointer: (parentId: number, path: string) => runAction(parentId, { kind: 'recordPointers', paths: [path] }),
  }
}
