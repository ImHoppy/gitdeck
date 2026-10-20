import { useEffect, useRef } from 'react'
import { gitd } from '../protocol/client'
import type { WorkspaceSnapshot } from '../protocol/types'

const norm = (p: string) => p.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()

/**
 * `?open=<folder>` (from `gitd --open`, the Explorer menu): opens the project holding that folder
 * (adding one when none does), then selects the repo there.
 */
export function useOpenParam(
  workspace: WorkspaceSnapshot | null,
  pick: (id: number) => void,
  openWorkspace: (name: string) => Promise<unknown>,
  onError: (message: string) => void,
) {
  const tried = useRef(false)
  useEffect(() => {
    const url = new URL(location.href)
    const path = url.searchParams.get('open')
    if (!path) return
    const target = norm(path)
    const holder = workspace?.repos
      .filter((r) => target === norm(r.path) || target.startsWith(`${norm(r.path)}/`))
      .sort((a, b) => b.path.length - a.path.length)[0]
    if (holder) {
      pick(holder.id)
      url.searchParams.delete('open')
      history.replaceState(null, '', url)
    } else if (!tried.current) {
      tried.current = true
      gitd.call<string>('project.open', { path }).then(openWorkspace, (e: Error) => onError(e.message))
    }
  }, [workspace, pick, openWorkspace, onError])
}
