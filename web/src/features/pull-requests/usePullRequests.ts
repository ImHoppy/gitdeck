import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { gitd } from '../../protocol/client'
import type { GithubRepoLink, ListState, PrList } from '../../protocol/github'
import { byUpdated, type PrRow } from './filter'
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
 * The PRs of `repos` (one repo, or every repo for "All repos"), kept live: gitd pushes a
 * list whenever a refresh finds it changed.
 */
export function usePullRequests(repos: GithubRepoLink[], state: ListState, enabled: boolean) {
  const [lists, setLists] = useState<Record<string, PrList>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const seen = useSeen()
  const key = repos.map((r) => `${r.id}:${r.repo}`).join(',')

  const load = useCallback(
    (refresh: boolean) => {
      if (!enabled || repos.length === 0) return
      setLoading(true)
      // clones of the same GitHub repo share one list
      const unique = repos.filter((r, i) => repos.findIndex((o) => same(o.repo, r.repo)) === i)
      void Promise.all(
        unique.map((r) =>
          gitd.call<PrList>('pr.list', { id: r.id, state, refresh }).then(
            (list) => {
              setBaseline(list.repo, new Date(list.at * 1000).toISOString())
              setLists((l) => ({ ...l, [`${r.repo.toLowerCase()}:${state}`]: list }))
              setErrors((e) => ({ ...e, [r.repo]: '' }))
            },
            (e: Error) => setErrors((all) => ({ ...all, [r.repo]: e.message })),
          ),
        ),
      ).finally(() => setLoading(false))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, state, enabled],
  )

  useEffect(() => load(false), [load])

  useEffect(
    () =>
      gitd.on<PrList>('pull-requests', (list) => {
        if (list.state === state) setLists((l) => ({ ...l, [`${list.repo.toLowerCase()}:${list.state}`]: list }))
      }),
    [state],
  )

  const rows: PrRow[] = useMemo(() => {
    const out: PrRow[] = []
    const added = new Set<string>()
    for (const r of repos) {
      const k = `${r.repo.toLowerCase()}:${state}`
      if (added.has(k)) continue
      added.add(k)
      for (const pr of lists[k]?.prs ?? []) out.push({ ...pr, repo: lists[k].repo, repoId: r.id })
    }
    return out.sort(byUpdated)
  }, [lists, repos, state])

  const unread = useMemo(() => new Set(rows.filter((p) => isUnread(seen, p.repo, p.number, p.updatedAt)).map((p) => `${p.repo}#${p.number}`)), [rows, seen])
  const error = Object.entries(errors).find(([, e]) => e)?.[1] ?? null
  const refresh = useCallback(() => load(true), [load])

  const [growing, setGrowing] = useState(false)
  const [paged, setPaged] = useState({ at: '', page: 1 })
  const scope = `${key}:${state}`
  const page = paged.at === scope ? paged.page : 1
  const unique = useMemo(() => repos.filter((r, i) => repos.findIndex((o) => same(o.repo, r.repo)) === i), [repos])
  const listOf = useCallback((r: GithubRepoLink) => lists[`${r.repo.toLowerCase()}:${state}`], [lists, state])
  const complete = unique.every((r) => listOf(r)?.complete ?? true)

  /** Page `p` holds PRs `(p-1)*100 … p*100` of the merged list; gh lists from the top, so the lists grow to reach it. */
  const goTo = useCallback(
    (p: number) => {
      setPaged({ at: scope, page: p })
      const need = p * PAGE
      const short = unique.filter((r) => listOf(r) && !listOf(r).complete && listOf(r).limit < need)
      if (!enabled || short.length === 0) return
      setGrowing(true)
      void Promise.all(
        short.map((r) =>
          gitd.call<PrList>('pr.list', { id: r.id, state, limit: need }).then(
            (list) => setLists((l) => ({ ...l, [`${r.repo.toLowerCase()}:${state}`]: list })),
            (e: Error) => setErrors((all) => ({ ...all, [r.repo]: e.message })),
          ),
        ),
      ).finally(() => setGrowing(false))
    },
    [scope, unique, listOf, enabled, state],
  )

  const pageRows = useMemo(() => rows.slice((page - 1) * PAGE, page * PAGE), [rows, page])
  const pages = complete ? Math.max(1, Math.ceil(rows.length / PAGE)) : null
  const hasNext = rows.length > page * PAGE || !complete
  return { rows: pageRows, unread, error, loading: loading || growing, refresh, page, pages, hasNext, goTo }
}
