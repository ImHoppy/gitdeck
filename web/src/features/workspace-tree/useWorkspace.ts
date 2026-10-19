import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { RepoSnapshot, WorkspaceSnapshot } from '../../protocol/types'

export function useWorkspace() {
  const [names, setNames] = useState<string[]>([])
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback(async (name: string) => {
    try {
      setWorkspace(await gitd.call<WorkspaceSnapshot>('workspace.open', { name }))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    gitd
      .call<string[]>('workspace.list')
      .then((list) => {
        setNames(list)
        if (list.length > 0) return open(list[0])
      })
      .catch((e: Error) => setError(e.message))
  }, [open])

  useEffect(
    () =>
      gitd.on<RepoSnapshot>('repo-state', (updated) =>
        setWorkspace((ws) => ws && { ...ws, repos: ws.repos.map((r) => (r.id === updated.id ? updated : r)) }),
      ),
    [],
  )

  return { names, workspace, error, open }
}
