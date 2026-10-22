import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { gitd } from '../../protocol/client'
import type { GithubRepoLink, PrList, PrQuery } from '../../protocol/github'
import { bySort, type PrRow, queryKey } from './filter'
import { isUnread, loadSeen, SEEN_EVENT, setBaseline } from './unread'

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** PRs per page of the list (gitd caps how far the pages go). */
const PAGE = 100

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_EVENT) ?? ''
  } catch {
    return ''
  }
}

function useSeen() {
  const subscribe = useCallback((on: () => void) => {
    window.addEventListener(SEEN_EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(SEEN_EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  const raw = useSyncExternalStore(subscribe, readSeen)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => loadSeen(), [raw])
}

/**
 * The PRs of `repos` (one repo, or every repo for "All repos") as `query` filters and sorts
 * them, kept live: gitd pushes a list whenever a refresh finds it changed.
 */
export function usePullRequests(repos: GithubRepoLink[], query: PrQuery, enabled: boolean) {
  const [lists, setLists] = useState<Record<string, PrList>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const seen = useSeen()
  const key = repos.map((r) => `${r.id}:${r.repo}`).join(',')
  const qk = queryKey(query)
  const listKey = useCallback((repo: string) => `${repo.toLowerCase()}:${qk}`, [qk])

  const load = useCallback(
    (refresh: boolean) => {
      if (!enabled || repos.length === 0) return
      setLoading(true)
      // clones of the same GitHub repo share one list
      const unique = repos.filter((r, i) => repos.findIndex((o) => same(o.repo, r.repo)) === i)
      void Promise.all(
        unique.map((r) =>
          gitd.call<PrList>('pr.list', { id: r.id, ...query, refresh }).then(
            (list) => {
              setBaseline(list.repo, new Date(list.at * 1000).toISOString())
              setLists((l) => ({ ...l, [listKey(r.repo)]: list }))
              setErrors((e) => ({ ...e, [r.repo]: '' }))
            },
            (e: Error) => setErrors((all) => ({ ...all, [r.repo]: e.message })),
          ),
        ),
      ).finally(() => setLoading(false))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, listKey, enabled],
  )

  useEffect(() => load(false), [load])

  useEffect(
    () =>
      gitd.on<PrList>('pull-requests', (list) => {
        if (queryKey(list) === qk) setLists((l) => ({ ...l, [listKey(list.repo)]: list }))
      }),
    [qk, listKey],
  )

  const rows: PrRow[] = useMemo(() => {
    const out: PrRow[] = []
    const added = new Set<string>()
    for (const r of repos) {
      const k = listKey(r.repo)
      if (added.has(k)) continue
      added.add(k)
      for (const pr of lists[k]?.prs ?? []) out.push({ ...pr, repo: lists[k].repo, repoId: r.id })
    }
    return out.sort(bySort(query.sort, query.order))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, repos, listKey])

  const unread = useMemo(() => new Set(rows.filter((p) => isUnread(seen, p.repo, p.number, p.updatedAt)).map((p) => `${p.repo}#${p.number}`)), [rows, seen])
  const error = Object.entries(errors).find(([, e]) => e)?.[1] ?? null
  const refresh = useCallback(() => load(true), [load])

  const [growing, setGrowing] = useState(false)
  const [paged, setPaged] = useState({ at: '', page: 1 })
  const pagesOf = `${key}:${qk}`
  const page = paged.at === pagesOf ? paged.page : 1
  const unique = useMemo(() => repos.filter((r, i) => repos.findIndex((o) => same(o.repo, r.repo)) === i), [repos])
  const listOf = useCallback((r: GithubRepoLink) => lists[listKey(r.repo)], [lists, listKey])
  const complete = unique.every((r) => listOf(r)?.complete ?? true)

  /** Page `p` holds PRs `(p-1)*100 … p*100` of the merged list; gh lists from the top, so the lists grow to reach it. */
  const goTo = useCallback(
    (p: number) => {
      setPaged({ at: pagesOf, page: p })
      const need = p * PAGE
      const short = unique.filter((r) => listOf(r) && !listOf(r).complete && listOf(r).limit < need)
      if (!enabled || short.length === 0) return
      setGrowing(true)
      void Promise.all(
        short.map((r) =>
          gitd.call<PrList>('pr.list', { id: r.id, ...query, limit: need }).then(
            (list) => setLists((l) => ({ ...l, [listKey(r.repo)]: list })),
            (e: Error) => setErrors((all) => ({ ...all, [r.repo]: e.message })),
          ),
        ),
      ).finally(() => setGrowing(false))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pagesOf, unique, listOf, enabled, listKey],
  )

  const pageRows = useMemo(() => rows.slice((page - 1) * PAGE, page * PAGE), [rows, page])
  const pages = complete ? Math.max(1, Math.ceil(rows.length / PAGE)) : null
  const hasNext = rows.length > page * PAGE || !complete
  return { rows: pageRows, unread, error, loading: loading || growing, refresh, page, pages, hasNext, goTo }
}
