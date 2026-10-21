import { VirtualList } from '../../ui/VirtualList/VirtualList'
import { type PrRow, rowKey } from './filter'
import { PrListRow } from './PrListRow'
import styles from './PullRequests.module.css'

const ROW_HEIGHT = 46

type Props = {
  rows: PrRow[]
  unread: ReadonlySet<string>
  selected: string | null
  checkedOut: (pr: PrRow) => boolean
  showRepo: boolean
  empty: string
  /** `move`: picked with the arrow keys, not worth a history entry. */
  onSelect: (pr: PrRow, move: boolean) => void
  onEnter: () => void
}

export function PrList({ rows, unread, selected, checkedOut, showRepo, empty, onSelect, onEnter }: Props) {
  const index = rows.findIndex((r) => rowKey(r) === selected)
  if (rows.length === 0) return <div className={styles.emptyList}>{empty}</div>
  return (
    <div
      className={styles.list}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          const next = Math.min(rows.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))
          onSelect(rows[next], true)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          onEnter()
        }
      }}
    >
      <VirtualList
        count={rows.length}
        rowHeight={ROW_HEIGHT}
        scrollTo={index >= 0 ? index : null}
        renderRow={(i) => {
          const pr = rows[i]
          return (
            <PrListRow
              pr={pr}
              unread={unread.has(rowKey(pr))}
              selected={rowKey(pr) === selected}
              checkedOut={checkedOut(pr)}
              showRepo={showRepo}
              onClick={() => onSelect(pr, false)}
            />
          )
        }}
      />
    </div>
  )
}
