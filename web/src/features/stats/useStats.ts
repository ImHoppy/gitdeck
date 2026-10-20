import { useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'

export type AuthorStats = { name: string; email: string; commits: number; added: number; removed: number; first: number; last: number }

export type RepoStats = {
  commits: number
  added: number
  removed: number
  first: number | null
  last: number | null
  files: number
  authors: AuthorStats[]
  months: [string, number][]
  extensions: [string, number][]
}

export function useStats(repoId: number | null) {
  const [stats, setStats] = useState<RepoStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (repoId === null) return
    let live = true
    gitd.call<RepoStats>('repo.stats', { id: repoId }).then(
      (s) => live && setStats(s),
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [repoId])

  return { stats, error }
}
