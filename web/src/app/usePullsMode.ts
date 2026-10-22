import { useCallback, useEffect, useMemo } from 'react'
import { NO_PULLS, placeIn, PULLS_KEY, type PullsPlace, usePrStatus, usePullRequests } from '../features/pull-requests'
import { requestHistory } from '../lib/historyTarget'
import { navPushMany, useNavState } from '../lib/navState'
import { pullsInWindow } from '../lib/pullsWindow'
import { gitd } from '../protocol/client'
import type { WorkspaceSnapshot } from '../protocol/types'
import type { MainMode } from './ModeToggle'
import { openWindow } from './windows'

/** Sent through gitd from the PR window: the main window selects this in its history. */
export type NavigateTarget = { workspace: string; repoPath: string; rev: string }

const samePath = (a: string, b: string) => a.replaceAll('\\', '/').toLowerCase() === b.replaceAll('\\', '/').toLowerCase()

type Deps = {
  workspace: WorkspaceSnapshot | null
  selectedId: number | null
  /** Re-asks whether gh works when the setting changes. */
  settingKey: unknown
  /** The repo view comes forward (phones show one pane at a time). */
  revealRepo: () => void
}

/** The main window's History / Pull requests toggle, both kept in browser history. */
export function usePullsMode({ workspace, selectedId, settingKey, revealRepo }: Deps) {
  const availability = usePrStatus(`${workspace?.name}:${String(settingKey)}`)
  const [mode, pushMode] = useNavState<MainMode>('mode', 'history')
  const [stored, , replaceStored] = useNavState<PullsPlace>(PULLS_KEY, NO_PULLS)
  const project = workspace?.name ?? null
  const place = useMemo(() => placeIn(stored, project), [stored, project])
  const replacePlace = useCallback((next: PullsPlace) => replaceStored({ ...next, project }), [replaceStored, project])
  const current = availability.repos.filter((l) => l.id === selectedId)
  // on but not usable (no gh, no login): the view itself says what to do on the host
  const enabled = !!availability.status?.enabled
  const currentPrs = usePullRequests(current, 'open', 'all', availability.ready)
  const unread = currentPrs.unread.size

  const push = useCallback(
    (next: PullsPlace, repoPath?: string) => {
      const browse = repoPath && workspace ? { browse: { project: workspace.name, repo: repoPath } } : {}
      navPushMany({ [PULLS_KEY]: { ...next, project: workspace?.name ?? null }, mode: 'pulls', ...browse })
    },
    [workspace],
  )

  const open = useCallback(
    (next: Partial<PullsPlace> = {}) => {
      if (!workspace) return
      if (pullsInWindow() && selectedId !== null) {
        openWindow({ kind: 'pulls', repo: selectedId, pr: next.pr ?? undefined, prRepo: next.prRepo ?? undefined }, workspace.name)
        return
      }
      if (Object.keys(next).length) navPushMany({ [PULLS_KEY]: { ...place, ...next, project: workspace.name }, mode: 'pulls' })
      else pushMode('pulls')
    },
    [workspace, selectedId, place, pushMode],
  )

  const showInHistory = useCallback(
    (repoId: number, rev: string) => {
      const path = workspace?.repos.find((r) => r.id === repoId)?.path
      if (!workspace || !path) return
      navPushMany({ mode: 'history', browse: { project: workspace.name, repo: path } })
      revealRepo()
      requestHistory({ repoId, rev })
    },
    [workspace, revealRepo],
  )

  // the PR window asks through gitd, so the windows stay in sync without sharing React state
  useEffect(
    () =>
      gitd.on<NavigateTarget>('navigate', (t) => {
        const repo = workspace?.name === t.workspace ? workspace.repos.find((r) => samePath(r.path, t.repoPath)) : undefined
        if (repo) showInHistory(repo.id, t.rev)
      }),
    [workspace, showInHistory],
  )

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p')) return
      e.preventDefault()
      if (mode === 'pulls') pushMode('history')
      else open()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, mode, open, pushMode])

  const shown: MainMode = enabled ? mode : 'history'
  return useMemo(
    () => ({ availability, mode: shown, setMode: (m: MainMode) => (m === 'pulls' ? open() : pushMode(m)), place, push, replace: replacePlace, open, showInHistory, unread, link: current[0] ?? null, prs: currentPrs.rows }),
    [availability, shown, open, pushMode, place, push, replacePlace, showInHistory, unread, current, currentPrs.rows],
  )
}
