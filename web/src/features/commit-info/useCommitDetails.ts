import { useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { CommitDetails } from '../../protocol/types'

const cache = new Map<string, CommitDetails>()

export function useCommitDetails(repoId: number, sha: string) {
  const [loaded, setLoaded] = useState<{ sha: string; details: CommitDetails | null; error: string | null } | null>(null)

  useEffect(() => {
    if (cache.has(sha)) return
    let live = true
    gitd.call<CommitDetails>('commit.body', { id: repoId, sha }).then(
      (details) => {
        cache.set(sha, details)
        if (live) setLoaded({ sha, details, error: null })
      },
      (e: Error) => live && setLoaded({ sha, details: null, error: e.message }),
    )
    return () => {
      live = false
    }
  }, [repoId, sha])

  const cached = cache.get(sha)
  if (cached) return { details: cached, error: null }
  return loaded?.sha === sha ? loaded : { details: null, error: null }
}
