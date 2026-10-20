import type { RepoSnapshot, SyncKind } from '../../protocol/types'
import type { MenuItem } from '../../ui/Menu/Menu'

export type TreeMenuDeps = {
  open: (id: number) => void
  sync: (id: number, kind: SyncKind) => void
  reveal: (id: number, what: 'explorer' | 'terminal') => void
  openInEditor: (id: number) => void
  checkoutTracked: (id: number) => void
  submodule: (id: number, op: 'init' | 'update') => Promise<boolean>
  recordPointer: (parentId: number, path: string) => void
  refresh: () => void
  removeRoot: (path: string) => void
  setExcluded: (path: string, excluded: boolean) => void
  /** Roots that also show the git repos cloned inside them; null: not a root. */
  nested: boolean | null
  setNested: (path: string, on: boolean) => void
}

export function treeMenu(repo: RepoSnapshot, d: TreeMenuDeps): MenuItem[] {
  const s = repo.state
  const sub = repo.parent !== null && repo.pathInParent !== null
  const items: MenuItem[] = []
  const workspaceItems: MenuItem[] = [
    'separator',
    repo.excluded
      ? { key: 'include', label: 'Include in auto fetch and live status', onSelect: () => d.setExcluded(repo.path, false) }
      : { key: 'exclude', label: 'Exclude from auto fetch and live status', onSelect: () => d.setExcluded(repo.path, true) },
    ...(d.nested !== null
      ? [{ key: 'nested', label: 'Show repos cloned inside this folder', checked: d.nested, onSelect: () => d.setNested(repo.path, !d.nested) }]
      : []),
    ...(repo.parent === null ? [{ key: 'remove', label: 'Remove from workspace', icon: 'trash' as const, danger: true, onSelect: () => d.removeRoot(repo.path) }] : []),
  ]
  if (repo.excluded) return workspaceItems.slice(1)
  if (!repo.initialized) {
    if (sub) {
      items.push({
        key: 'init',
        label: 'Initialize submodule',
        onSelect: async () => {
          if (await d.submodule(repo.id, 'init')) d.refresh()
        },
      })
    }
    return items
  }
  const busy = !!s?.operation
  const onBranch = s?.head.kind === 'branch'
  items.push(
    { key: 'open', label: 'Open', icon: 'history', onSelect: () => d.open(repo.id) },
    'separator',
    { key: 'fetch', label: 'Fetch', icon: 'fetch', disabled: busy, onSelect: () => d.sync(repo.id, 'fetch') },
    { key: 'pull', label: 'Pull (rebase)', icon: 'pull', disabled: busy || !onBranch, onSelect: () => d.sync(repo.id, 'pull') },
    { key: 'push', label: 'Push', icon: 'push', disabled: busy || !onBranch, onSelect: () => d.sync(repo.id, 'push') },
    { key: 'sync', label: 'Sync', icon: 'sync', disabled: busy || !onBranch, onSelect: () => d.sync(repo.id, 'sync') },
  )
  if (s?.head.kind === 'detached') {
    items.push('separator', { key: 'tracked', label: 'Checkout tracked branch', icon: 'branch', onSelect: () => d.checkoutTracked(repo.id) })
  }
  if (sub) {
    items.push(
      'separator',
      { key: 'update', label: 'Update to recorded commit', disabled: busy, onSelect: () => void d.submodule(repo.id, 'update') },
      {
        key: 'record',
        label: 'Record pointer in superproject',
        disabled: !repo.pointerDiffers,
        onSelect: () => d.recordPointer(repo.parent!, repo.pathInParent!),
      },
    )
  }
  items.push(
    'separator',
    { key: 'explorer', label: 'Open in file explorer', icon: 'folder', onSelect: () => d.reveal(repo.id, 'explorer') },
    { key: 'editor', label: 'Open in editor', icon: 'editor', onSelect: () => d.openInEditor(repo.id) },
    { key: 'terminal', label: 'Open terminal here', icon: 'terminal', onSelect: () => d.reveal(repo.id, 'terminal') },
    { key: 'copy', label: 'Copy path', icon: 'copy', onSelect: () => void navigator.clipboard?.writeText(repo.path) },
    ...workspaceItems,
  )
  return items
}
