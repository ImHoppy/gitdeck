import { useCallback, useEffect, useState } from 'react'
import { loadSetting, saveSetting } from '../../lib/storedSetting'
import { gitd } from '../../protocol/client'
import type { RepoSnapshot, WorkspaceSnapshot } from '../../protocol/types'

const LAST = 'gitdeck.workspace'

export function useWorkspace() {
  const [names, setNames] = useState<string[] | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback(async (name: string) => {
    try {
      setWorkspace(await gitd.call<WorkspaceSnapshot>('workspace.open', { name }))
      saveSetting(LAST, name)
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
        const last = loadSetting(LAST, list, list[0])
        if (last) return open(last)
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

  const addRoot = useCallback(
    async (name: string, path: string) => {
      try {
        setNames(await gitd.call<string[]>('workspace.addRoot', { name, path }))
        await open(name)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [open],
  )

  const removeRoot = useCallback(
    async (name: string, path: string) => {
      setNames(await gitd.call<string[]>('workspace.removeRoot', { name, path }))
      await open(name)
    },
    [open],
  )

  const setExcluded = useCallback(
    async (name: string, path: string, excluded: boolean) => {
      await gitd.call('workspace.exclude', { name, path, excluded })
      await open(name)
    },
    [open],
  )

  return { names, workspace, error, open, addRoot, removeRoot, setExcluded }
}
