import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { ChangedFile, DiffTarget, RepoSnapshot } from '../../protocol/types'

export function useDiffFiles(repoId: number, target: DiffTarget, content?: string) {
  const [files, setFiles] = useState<ChangedFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const targetKey = JSON.stringify(target)

  const load = useCallback(() => {
    gitd.call<ChangedFile[]>('diff.files', { id: repoId, target: JSON.parse(targetKey), content }).then(
      (f) => {
        setFiles(f)
        setError(null)
      },
      (e: Error) => setError(e.message),
    )
  }, [repoId, targetKey, content])

  useEffect(load, [load])

  useEffect(() => {
    if (target.kind === 'commit') return
    return gitd.on<RepoSnapshot>('repo-state', (r) => {
      if (r.id === repoId) load()
    })
  }, [repoId, target.kind, load])

  /** Shows a change before the server confirms it; the next reload replaces it. */
  return { files, error, reload: load, update: setFiles }
}
