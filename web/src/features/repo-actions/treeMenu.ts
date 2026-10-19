import type { RepoSnapshot, SyncKind } from '../../protocol/types'
import type { MenuItem } from '../../ui/Menu/Menu'

export type TreeMenuDeps = {
  open: (id: number) => void
  sync: (id: number, kind: SyncKind) => void
  reveal: (id: number, what: 'explorer' | 'terminal') => void
  checkoutTracked: (id: number) => void
  submodule: (id: number, op: 'init' | 'update') => Promise<boolean>
  recordPointer: (parentId: number, path: string) => void
  refresh: () => void
}

export function treeMenu(repo: RepoSnapshot, d: TreeMenuDeps): MenuItem[] {
  const s = repo.state
  const sub = repo.parent !== null && repo.pathInParent !== null
  const items: MenuItem[] = []
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
    { key: 'open', label: 'Open', onSelect: () => d.open(repo.id) },
    'separator',
    { key: 'fetch', label: '⤓ Fetch', disabled: busy, onSelect: () => d.sync(repo.id, 'fetch') },
    { key: 'pull', label: '⇣ Pull (rebase)', disabled: busy || !onBranch, onSelect: () => d.sync(repo.id, 'pull') },
    { key: 'push', label: '⇡ Push', disabled: busy || !onBranch, onSelect: () => d.sync(repo.id, 'push') },
    { key: 'sync', label: '⟳ Sync', disabled: busy || !onBranch, onSelect: () => d.sync(repo.id, 'sync') },
  )
  if (s?.head.kind === 'detached') {
    items.push('separator', { key: 'tracked', label: 'Checkout tracked branch', onSelect: () => d.checkoutTracked(repo.id) })
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
    { key: 'explorer', label: 'Open in file explorer', onSelect: () => d.reveal(repo.id, 'explorer') },
    { key: 'terminal', label: 'Open terminal here', onSelect: () => d.reveal(repo.id, 'terminal') },
    { key: 'copy', label: 'Copy path', onSelect: () => void navigator.clipboard?.writeText(repo.path) },
  )
  return items
}
