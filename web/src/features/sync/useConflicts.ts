import { useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { RepoSnapshot } from '../../protocol/types'

export function hasConflicts(repo: RepoSnapshot | undefined): boolean {
  const s = repo?.state
  return !!s && (s.operation !== null || s.status.conflicts > 0)
}

export function useConflicts(repo: RepoSnapshot | undefined): string[] {
  const [loaded, setLoaded] = useState<{ id: number; files: string[] } | null>(null)
  const active = hasConflicts(repo)
  const id = repo?.id
  const conflicts = repo?.state?.status.conflicts

  useEffect(() => {
    if (!active || id === undefined) return
    let live = true
    gitd
      .call<string[]>('repo.conflicts', { id })
      .then((files) => live && setLoaded({ id, files }))
      .catch(() => live && setLoaded({ id, files: [] }))
    return () => {
      live = false
    }
  }, [active, id, conflicts])

  return active && loaded && loaded.id === id ? loaded.files : []
}
