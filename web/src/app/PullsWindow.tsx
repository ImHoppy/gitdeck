import { useCallback, useEffect, useMemo } from 'react'
import { NO_PULLS, PULLS_KEY, type PullsPlace, PullRequestsView, usePrStatus } from '../features/pull-requests'
import { useServerInfo } from '../features/settings'
import { useWorkspace } from '../features/workspace-tree'
import { navPush, navReplace, useNavState } from '../lib/navState'
import { gitd } from '../protocol/client'
import styles from './App.module.css'
import type { NavigateTarget } from './usePullsMode'

type Props = { workspace: string; repoId: number; pr: number | null; prRepo: string | null }

/**
 * The PR view in a window of its own (`?pulls=1`), beside the history. It has its own browser
 * history, so its Back never moves the main window; commit links go there through gitd.
 */
export function PullsWindow({ workspace: wsName, repoId, pr, prRepo }: Props) {
  const { workspace, error, open } = useWorkspace()
  useEffect(() => {
    void open(wsName)
  }, [open, wsName])
  const server = useServerInfo()
  // asked once the workspace is live here: gitd lists the GitHub repos of the open workspace
  const availability = usePrStatus(`${workspace?.name}:${String(server.info?.githubPrs)}`)
  const [place] = useNavState<PullsPlace>(PULLS_KEY, NO_PULLS)
  const startPath = workspace?.repos.find((r) => r.id === repoId)?.path ?? null

  useEffect(() => {
    // the first load: the PR asked for in the URL, then history keeps the place across reloads
    if (!startPath || (history.state as Record<string, unknown> | null)?.[PULLS_KEY]) return
    navReplace(PULLS_KEY, { ...NO_PULLS, repo: startPath, pr, prRepo })
  }, [startPath, pr, prRepo])

  useEffect(() => {
    document.title = `Pull requests · ${wsName}`
  }, [wsName])

  const showInHistory = useCallback(
    (id: number, rev: string) => {
      const path = workspace?.repos.find((r) => r.id === id)?.path
      if (!path) return
      const target: NavigateTarget = { workspace: wsName, repoPath: path, rev }
      void gitd.call('ui.navigate', { target })
    },
    [workspace, wsName],
  )
  const pop = useMemo(() => ({ title: 'Back into the main window (closes this one)', run: () => window.close() }), [])

  if (!workspace) return <div className={styles.message}>{error ?? 'Loading…'}</div>
  return (
    <div className={styles.pullsWindow}>
      <PullRequestsView
        workspace={workspace}
        availability={availability}
        place={place}
        push={(next) => navPush(PULLS_KEY, next)}
        replace={(next) => navReplace(PULLS_KEY, next)}
        currentRepoId={repoId}
        pop={pop}
        onShowInHistory={showInHistory}
      />
    </div>
  )
}
