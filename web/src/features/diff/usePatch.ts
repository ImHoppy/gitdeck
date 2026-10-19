import { useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { ChangedFile, DiffTarget, Patch } from '../../protocol/types'

export function usePatch(repoId: number, target: DiffTarget, file: ChangedFile | null, version: unknown) {
  const [loaded, setLoaded] = useState<{ key: string; patch: Patch | null; error: string | null } | null>(null)
  const key = JSON.stringify([repoId, target, file])

  useEffect(() => {
    if (!file) return
    let live = true
    gitd.call<Patch>('diff.file', { id: repoId, target, file }).then(
      (patch) => live && setLoaded({ key, patch, error: null }),
      (e: Error) => live && setLoaded({ key, patch: null, error: e.message }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  return loaded?.key === key ? loaded : null
}
