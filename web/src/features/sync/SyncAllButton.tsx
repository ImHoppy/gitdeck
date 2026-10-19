import { IconButton } from '../../ui/IconButton/IconButton'

type Props = { running: boolean; onClick: () => void }

export function SyncAllButton({ running, onClick }: Props) {
  return (
    <IconButton title="Sync every repo: fetch, rebase if behind, push if ahead" disabled={running} onClick={onClick}>
      {running ? '…' : '⟳'} sync all
    </IconButton>
  )
}
