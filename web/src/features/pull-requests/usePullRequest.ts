import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { PrCheck, PrDetail, PrFetch, Timeline } from '../../protocol/github'
import { markSeen } from './unread'

/** A workspace repo, or `owner/name` for a PR outside the workspace. */
export type PrTarget = { id: number | null; repo: string }

const POLL_MS = 3 * 60 * 1000

export const targetParams = (t: PrTarget) => (t.id === null ? { repo: t.repo } : { id: t.id, repo: t.repo })

/** One PR's detail and conversation, refreshed every few minutes while it is shown. */
export function usePullRequest(target: PrTarget | null, number: number | null) {
  const [detail, setDetail] = useState<PrDetail | null>(null)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = target && number ? `${target.id}:${target.repo}#${number}` : null

  const load = useCallback(() => {
    if (!target || !number) return
    const params = { ...targetParams(target), number }
    gitd.call<PrDetail>('pr.view', params).then(
      (d) => {
        setDetail(d)
        setError(null)
        markSeen(target.repo, number, d.updatedAt)
      },
      (e: Error) => setError(e.message),
    )
    gitd.call<Timeline>('pr.timeline', params).then(setTimeline, (e: Error) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    setDetail(null)
    setTimeline(null)
    setError(null)
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  return { detail: detail?.number === number ? detail : null, timeline, error, reload: load }
}

export function useChecks(target: PrTarget | null, number: number | null, active: boolean) {
  const [checks, setChecks] = useState<PrCheck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = target && number ? `${target.id}:${target.repo}#${number}` : null
  const load = useCallback(() => {
    if (!target || !number) return
    gitd.call<PrCheck[]>('pr.checks', { ...targetParams(target), number }).then(setChecks, (e: Error) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    setChecks(null)
    if (active) load()
  }, [load, active])
  return { checks, error, reload: load }
}

/** `refs/pull/<n>/head` and the base fetched with plain git: what the Files tab diffs. */
export function usePrFetch(repoId: number | null, detail: PrDetail | null, active: boolean) {
  const [fetched, setFetched] = useState<{ key: string; value: PrFetch | null; error: string | null } | null>(null)
  const key = repoId !== null && detail ? `${repoId}:${detail.number}:${detail.headRefOid}:${detail.baseRefName}` : null
  useEffect(() => {
    if (!active || !key || !detail || repoId === null || fetched?.key === key) return
    gitd.call<PrFetch>('pr.fetch', { id: repoId, number: detail.number, base: detail.baseRefName }).then(
      (value) => setFetched({ key, value, error: null }),
      (e: Error) => setFetched({ key, value: null, error: e.message }),
    )
  }, [active, key, detail, repoId, fetched?.key])
  return fetched?.key === key ? fetched : null
}
