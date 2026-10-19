import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { ChangedFile, DiffTarget, RepoSnapshot } from '../../protocol/types'

export function useDiffFiles(repoId: number, target: DiffTarget) {
  const [files, setFiles] = useState<ChangedFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const targetKey = JSON.stringify(target)

  const load = useCallback(() => {
    gitd.call<ChangedFile[]>('diff.files', { id: repoId, target: JSON.parse(targetKey) }).then(
      (f) => {
        setFiles(f)
        setError(null)
      },
      (e: Error) => setError(e.message),
    )
  }, [repoId, targetKey])

  useEffect(load, [load])

  useEffect(() => {
    if (target.kind === 'commit') return
    return gitd.on<RepoSnapshot>('repo-state', (r) => {
      if (r.id === repoId) load()
    })
  }, [repoId, target.kind, load])

  return { files, error, reload: load }
}
