import { useCallback, useEffect, useState } from 'react'
import { touchRecent } from '../start'
import { gitd } from '../../protocol/client'
import type { RepoSnapshot, WorkspaceSnapshot } from '../../protocol/types'

export function useWorkspace() {
  const [names, setNames] = useState<string[] | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const open = useCallback(async (name: string, reload = false): Promise<WorkspaceSnapshot | null> => {
    setOpening(name)
    gitd.workspace = name
    try {
      const ws = await gitd.call<WorkspaceSnapshot>('workspace.open', { name, reload })
      setWorkspace(ws)
      touchRecent(name)
      setError(null)
      return ws
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setOpening(null)
    }
  }, [])

  // nothing opens by itself: the start page picks the project
  useEffect(() => {
    gitd.call<string[]>('workspace.list').then(setNames, (e: Error) => setError(e.message))
  }, [])

  const close = useCallback(() => setWorkspace(null), [])

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
        await open(name, true)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [open],
  )

  const removeRoot = useCallback(
    async (name: string, path: string) => {
      setNames(await gitd.call<string[]>('workspace.removeRoot', { name, path }))
      await open(name, true)
    },
    [open],
  )

  const setExcluded = useCallback(
    async (name: string, path: string, excluded: boolean) => {
      await gitd.call('workspace.exclude', { name, path, excluded })
      await open(name, true)
    },
    [open],
  )

  const setNested = useCallback(
    async (name: string, path: string, on: boolean) => {
      try {
        await gitd.call('workspace.setNested', { name, path, on })
        await open(name, true)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [open],
  )

  return { names, workspace, error, opening, open, close, addRoot, removeRoot, setExcluded, setNested }
}
