import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { RepoSnapshot, Stash } from '../../protocol/types'

export function useStashes(repoId: number) {
  const [stashes, setStashes] = useState<Stash[]>([])

  const load = useCallback(() => {
    gitd.call<Stash[]>('stash.list', { id: repoId }).then(setStashes, () => setStashes([]))
  }, [repoId])

  useEffect(load, [load])
  useEffect(() => gitd.on<RepoSnapshot>('repo-state', (r) => r.id === repoId && load()), [repoId, load])

  return stashes
}
