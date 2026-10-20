import { Icon } from '../Icon/Icon'
import styles from './DiffViewer.module.css'

type Props = {
  query: string
  count: number
  /** 0-based index of the current match, -1 for none. */
  current: number
  onSearch: (query: string) => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

export function DiffFind({ query, count, current, onSearch, onNext, onPrev, onClose }: Props) {
  return (
    <div className={styles.find}>
      <Icon name="search" size={12} />
      <input
        autoFocus
        className={styles.findInput}
        placeholder="Find in diff"
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) onPrev()
            else onNext()
          } else if (e.key === 'Escape') {
            // only the find bar closes, not the commit page around the diff
            e.stopPropagation()
            onClose()
          }
        }}
      />
      <span className={styles.findCount}>{query ? (count ? `${current + 1}/${count}` : '0/0') : ''}</span>
      <button className={styles.findButton} title="Previous (Shift+Enter)" disabled={!count} onClick={onPrev}>
        ↑
      </button>
      <button className={styles.findButton} title="Next (Enter)" disabled={!count} onClick={onNext}>
        ↓
      </button>
      <button className={styles.findButton} title="Close (Esc)" onClick={onClose}>
        <Icon name="close" size={10} />
      </button>
    </div>
  )
}
