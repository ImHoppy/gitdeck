/** The extra windows gitdeck opens (native windows in the app, popups in a browser). */
export type WindowKind =
  | { kind: 'commit'; repo: number }
  | { kind: 'show'; repo: number; sha: string; parents: string[] }
  | { kind: 'compare'; repo: number; newest: string; base: string; count: number }
  | { kind: 'history'; repo: number; path: string }
  | { kind: 'stats'; repo: number }
  | { kind: 'reflog'; repo: number }

const SIZE: Record<WindowKind['kind'], string> = {
  commit: 'width=1100,height=720',
  show: 'width=1200,height=850',
  compare: 'width=1200,height=850',
  history: 'width=1300,height=850',
  stats: 'width=1100,height=850',
  reflog: 'width=1100,height=800',
}

export function openWindow(w: WindowKind, workspace: string) {
  const q = new URLSearchParams({ ws: workspace, repo: String(w.repo) })
  let name: string = w.kind
  if (w.kind === 'commit') q.set('commit', String(w.repo))
  if (w.kind === 'stats') q.set('stats', String(w.repo))
  if (w.kind === 'reflog') q.set('reflog', String(w.repo))
  if (w.kind === 'show') {
    q.set('show', w.sha)
    q.set('parents', w.parents.join(','))
    name += w.sha
  }
  if (w.kind === 'compare') {
    q.set('compare', w.newest)
    q.set('base', w.base)
    q.set('count', String(w.count))
    name += w.newest + w.base
  }
  if (w.kind === 'history') {
    q.set('history', w.path)
    name += w.path
  }
  // the same name reuses that window instead of opening a second one
  window.open(`/?${q}`, `${name}-${w.repo}`, `popup,${SIZE[w.kind]}`)
}
