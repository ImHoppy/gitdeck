import type { PrDetail } from '../../protocol/github'
import type { MenuItem } from '../../ui/Menu/Menu'

type RebaseDeps = {
  checkedOut: boolean
  /** No clone of this repo in the workspace: only GitHub can update it. */
  local: boolean
  remote: string | null
  rebaseOntoBase: () => void
  interactive: () => void
  pushRebased: () => void
  updateOnGithub: () => void
}

export function rebaseMenu(d: PrDetail, x: RebaseDeps): MenuItem[] {
  const open = d.state === 'OPEN'
  const items: MenuItem[] = []
  if (x.local) {
    const here = x.checkedOut ? '' : ' (switch to the branch first)'
    items.push(
      { key: 'onto', label: `Rebase onto ${x.remote ?? 'origin'}/${d.baseRefName}${here}`, icon: 'history', disabled: !x.checkedOut || !open, onSelect: x.rebaseOntoBase },
      { key: 'interactive', label: `Interactive rebase from the merge base…${here}`, icon: 'list', disabled: !x.checkedOut || !open, onSelect: x.interactive },
      {
        key: 'push',
        label: d.isCrossRepository ? 'Push rebased branch (not to a fork yet)' : 'Push rebased branch…',
        icon: 'push',
        danger: true,
        disabled: !x.checkedOut || !open || d.isCrossRepository,
        onSelect: x.pushRebased,
      },
      'separator',
    )
  }
  items.push({ key: 'update', label: 'Update branch on GitHub (rebase)', icon: 'sync', disabled: !open, onSelect: x.updateOnGithub })
  return items
}

type MoreDeps = {
  canUpdate: boolean
  setState: (label: string, change: 'close' | 'reopen' | 'ready' | 'draft') => void
  edit: () => void
  refresh: () => void
}

export function moreMenu(d: PrDetail, x: MoreDeps): MenuItem[] {
  const open = d.state === 'OPEN'
  const items: MenuItem[] = []
  if (open && d.isDraft) items.push({ key: 'ready', label: 'Ready for review', icon: 'checkout', disabled: !x.canUpdate, onSelect: () => x.setState('Ready for review', 'ready') })
  if (open && !d.isDraft) items.push({ key: 'draft', label: 'Convert to draft', icon: 'restore', disabled: !x.canUpdate, onSelect: () => x.setState('Convert to draft', 'draft') })
  items.push({ key: 'edit', label: 'Edit title and description…', icon: 'editor', disabled: !x.canUpdate, onSelect: x.edit })
  if (open) items.push({ key: 'close', label: 'Close pull request', icon: 'close', danger: true, disabled: !x.canUpdate, onSelect: () => x.setState('Close', 'close') })
  if (d.state === 'CLOSED') items.push({ key: 'reopen', label: 'Reopen pull request', icon: 'restore', disabled: !x.canUpdate, onSelect: () => x.setState('Reopen', 'reopen') })
  items.push(
    'separator',
    { key: 'copy', label: 'Copy link', icon: 'copy', onSelect: () => void navigator.clipboard?.writeText(d.url) },
    { key: 'refresh', label: 'Refresh', icon: 'refresh', onSelect: x.refresh },
  )
  return items
}
