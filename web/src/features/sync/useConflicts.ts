import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { RepoSnapshot } from '../../protocol/types'

export type ConflictKind = 'bothModified' | 'bothAdded' | 'bothDeleted' | 'deletedByUs' | 'deletedByThem' | 'addedByUs' | 'addedByThem'

export type Conflict = { path: string; kind: ConflictKind }

export function hasConflicts(repo: RepoSnapshot | undefined): boolean {
  const s = repo?.state
  return !!s && (s.operation !== null || s.status.conflicts > 0)
}

/** The conflicted files of `repo`, reloaded whenever its conflict count changes. */
export function useConflicts(repo: RepoSnapshot | undefined): Conflict[] {
  const [loaded, setLoaded] = useState<{ id: number; files: Conflict[] } | null>(null)
  const active = hasConflicts(repo)
  const id = repo?.id
  const conflicts = repo?.state?.status.conflicts

  useEffect(() => {
    if (!active || id === undefined) return
    let live = true
    gitd
      .call<Conflict[]>('conflict.list', { id })
      .then((files) => live && setLoaded({ id, files }))
      .catch(() => live && setLoaded({ id, files: [] }))
    return () => {
      live = false
    }
  }, [active, id, conflicts])

  return active && loaded && loaded.id === id ? loaded.files : []
}

/** Settling conflicted files: keep a side, mark as resolved, or open the editor. */
export function useConflictActions(repoId: number | undefined) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (path: string | null, method: string, params: object) => {
      if (repoId === undefined) return
      setBusy(path ?? '*')
      setError(null)
      try {
        await gitd.call(method, { id: repoId, ...params })
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(null)
      }
    },
    [repoId],
  )

  return {
    busy,
    error,
    clearError: () => setError(null),
    take: (path: string, side: 'ours' | 'theirs') => run(path, 'conflict.take', { path, side }),
    resolved: (path: string) => run(path, 'conflict.resolved', { path }),
    openInEditor: (path?: string) => run(path ?? null, 'editor.open', { path }),
    mergeTool: (path: string) => run(path, 'tool.merge', { path }),
  }
}
