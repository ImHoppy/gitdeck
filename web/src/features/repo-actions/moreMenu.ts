import type { MenuItem } from '../../ui/Menu/Menu'
import type { useRepoTools } from './useRepoTools'

type Tools = ReturnType<typeof useRepoTools>

export type ViewOptions = { currentBranch: boolean; firstParent: boolean }

type Deps = {
  view: ViewOptions
  setView: (v: ViewOptions) => void
  tools: Tools
  bisecting: boolean
  open: (what: 'remotes' | 'worktrees' | 'reflog') => void
}

/** The toolbar's "More" menu: grid view options and the rarer repository tools. */
export function moreMenu({ view, setView, tools, bisecting, open }: Deps): MenuItem[] {
  return [
    { key: 'cur', label: 'Show the current branch only', checked: view.currentBranch, onSelect: () => setView({ ...view, currentBranch: !view.currentBranch }) },
    { key: 'fp', label: 'Show first parents only', checked: view.firstParent, onSelect: () => setView({ ...view, firstParent: !view.firstParent }) },
    'separator',
    { key: 'remotes', label: 'Remotes…', icon: 'fetch', onSelect: () => open('remotes') },
    { key: 'worktrees', label: 'Worktrees…', icon: 'folder', onSelect: () => open('worktrees') },
    { key: 'reflog', label: 'Reflog (recover lost commits)…', icon: 'history', onSelect: () => open('reflog') },
    'separator',
    { key: 'apply', label: 'Apply patches…', icon: 'file', onSelect: () => void tools.applyPatches() },
    ...(bisecting ? (['separator', { key: 'bisect-stop', label: 'Stop bisect', danger: true, onSelect: () => void tools.stopBisect() }] as MenuItem[]) : []),
  ]
}

/** Commit menu additions: bisect marks, patches and zip export of that commit. */
export function commitToolsMenu(tools: Tools, sha: string, subject: string): MenuItem[] {
  const short = sha.slice(0, 7)
  return [
    { key: 'bisect-bad', label: 'Bisect: mark bad', onSelect: () => void tools.bisect('bad', sha) },
    { key: 'bisect-good', label: 'Bisect: mark good', onSelect: () => void tools.bisect('good', sha) },
    { key: 'bisect-skip', label: 'Bisect: skip', onSelect: () => void tools.bisect('skip', sha) },
    'separator',
    { key: 'patch', label: 'Save as patch…', icon: 'file', onSelect: () => void tools.savePatches([sha]) },
    { key: 'zip', label: 'Export files as zip…', icon: 'folder', onSelect: () => void tools.archive(sha, `${short}-${subject.replace(/[^\w.-]+/g, '-').slice(0, 40)}`) },
  ]
}
