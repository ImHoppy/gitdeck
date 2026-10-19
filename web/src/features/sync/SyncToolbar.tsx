import type { SyncKind } from '../../protocol/types'
import { IconButton } from '../../ui/IconButton/IconButton'

type Props = { running: SyncKind | null; onRunAll: (kind: SyncKind) => void }

const BUTTONS: [SyncKind, string, string][] = [
  ['fetch', '⤓', 'Fetch every repo'],
  ['pull', '⇣', 'Pull (rebase) every repo that is behind'],
  ['push', '⇡', 'Push every repo that is ahead'],
  ['sync', '⟳', 'Sync every repo: fetch, rebase if behind, push if ahead'],
]

export function SyncToolbar({ running, onRunAll }: Props) {
  return (
    <>
      {BUTTONS.map(([kind, icon, title]) => (
        <IconButton key={kind} title={title} disabled={running !== null} onClick={() => onRunAll(kind)}>
          {running === kind ? '…' : icon} {kind} all
        </IconButton>
      ))}
    </>
  )
}
