import type { SyncKind } from '../../protocol/types'
import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'
import { PullButton } from './PullButton'
import type { PullAction } from './pullAction'

type Props = {
  running: SyncKind | null
  pullAction: PullAction
  onSetPullAction: (a: PullAction) => void
  onRunAll: (kind: SyncKind) => void
}

export function SyncToolbar({ running, pullAction, onSetPullAction, onRunAll }: Props) {
  return (
    <>
      <PullButton
        defaultAction={pullAction}
        disabled={running !== null}
        suffix={running && running !== 'push' ? ' … all' : ' all'}
        onRun={onRunAll}
        onSetDefault={onSetPullAction}
      />
      <IconButton title="Push every repo that is ahead" disabled={running !== null} onClick={() => onRunAll('push')}>
        {running === 'push' ? '…' : <Icon name="push" />} all
      </IconButton>
    </>
  )
}
