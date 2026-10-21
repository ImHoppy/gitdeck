import { useCallback, useEffect, useState } from 'react'
import type { GithubRepoLink, PrStatus } from '../../protocol/github'
import { gitd } from '../../protocol/client'

export type PrAvailability = {
  status: PrStatus | null
  /** Logged-in gh and the setting on: the PR UI shows. */
  ready: boolean
  login: string | null
  /** The workspace repos that have a GitHub remote. */
  repos: GithubRepoLink[]
  recheck: () => void
}

/**
 * Whether the PR view can work here. `key` changes (the setting toggled, another workspace)
 * ask again.
 */
export function usePrStatus(key: unknown): PrAvailability {
  const [status, setStatus] = useState<PrStatus | null>(null)
  const [repos, setRepos] = useState<GithubRepoLink[]>([])

  const load = useCallback((recheck: boolean) => {
    gitd.call<PrStatus>('pr.status', { recheck }).then(
      (s) => {
        setStatus(s)
        const ready = s.enabled && s.gh?.kind === 'ready'
        if (!ready) return setRepos([])
        gitd.call<GithubRepoLink[]>('pr.repos', { recheck }).then(setRepos, () => setRepos([]))
      },
      () => setStatus(null),
    )
  }, [])

  useEffect(() => load(false), [load, key])

  const ready = !!status?.enabled && status.gh?.kind === 'ready'
  return { status, ready, login: status?.gh?.kind === 'ready' ? status.gh.login : null, repos, recheck: () => load(true) }
}
