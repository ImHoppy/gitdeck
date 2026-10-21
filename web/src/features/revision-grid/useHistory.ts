import { useCallback, useEffect, useRef, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { HistoryInfo, HistoryRow, RepoSnapshot } from '../../protocol/types'

const PAGE = 200

export type HistoryOptions = { currentBranch: boolean; firstParent: boolean }

const ALL: HistoryOptions = { currentBranch: false, firstParent: false }

export function useHistory(repoId: number | null, filter = '', content = false, options: HistoryOptions = ALL) {
  const { currentBranch, firstParent } = options
  const [info, setInfo] = useState<HistoryInfo | null>(null)
  const [rows, setRows] = useState<ReadonlyMap<number, HistoryRow>>(new Map())
  const [error, setError] = useState<string | null>(null)
  // the search last answered: a different one is still running
  const [answered, setAnswered] = useState('')
  const asked = `${content}:${filter}`
  const searching = filter !== '' && answered !== asked
  const pending = useRef(new Set<number>())
  const key = useRef<string | null>(null)

  const open = useCallback(() => {
    if (repoId === null) return
    gitd.call<HistoryInfo>('log.open', { id: repoId, filter, content, options: { currentBranch, firstParent } }).then(
      (next) => {
        setAnswered(`${content}:${filter}`)
        setError(null)
        if (next.key === key.current) return
        key.current = next.key
        pending.current.clear()
        setRows(new Map())
        setInfo(next)
      },
      (e: Error) => {
        setAnswered(`${content}:${filter}`)
        setError(e.message)
      },
    )
  }, [repoId, filter, content, currentBranch, firstParent])

  useEffect(open, [open])

  useEffect(
    () =>
      gitd.on<RepoSnapshot>('repo-state', (r) => {
        if (r.id === repoId) open()
      }),
    [repoId, open],
  )

  const ensure = useCallback(
    (start: number, end: number) => {
      if (repoId === null || !info) return
      for (let page = Math.floor(start / PAGE); page * PAGE < end; page++) {
        if (pending.current.has(page) || rows.has(page * PAGE)) continue
        pending.current.add(page)
        const forKey = info.key
        gitd
          .call<HistoryRow[]>('log.rows', { id: repoId, key: forKey, start: page * PAGE, count: PAGE })
          .then((batch) => {
            if (key.current !== forKey) return
            setRows((old) => {
              const next = new Map(old)
              batch.forEach((row, i) => next.set(page * PAGE + i, row))
              return next
            })
          })
          .catch((e: Error) => {
            pending.current.delete(page)
            if (e.message !== 'stale') return
            key.current = null
            open()
          })
      }
    },
    [repoId, info, rows, open],
  )

  const locate = useCallback(
    (sha: string) => (repoId === null ? Promise.resolve(null) : gitd.call<number | null>('log.find', { id: repoId, sha, filter, content })),
    [repoId, filter, content],
  )

  const ancestors = useCallback(
    (sha: string) => gitd.call<number[]>('log.ancestors', { id: repoId, sha, filter, content }),
    [repoId, filter, content],
  )

  return { info, rows, ensure, error, searching, locate, ancestors, reload: open }
}
