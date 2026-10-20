import type { Ref } from 'react'
import { Icon } from '../../ui/Icon/Icon'
import { Select } from '../../ui/Select/Select'
import { Spinner } from '../../ui/Spinner/Spinner'
import styles from './HistorySearch.module.css'

export type SearchMode = 'message' | 'content'

const MODES = [
  ['message', 'Message, author, hash'],
  ['content', 'Content (diff)'],
] as const

const HINT: Record<SearchMode, string> = {
  message: 'Search message, author, hash (Ctrl+F)',
  content: 'Search text added or removed (Ctrl+F)',
}

type Props = {
  value: string
  mode: SearchMode
  searching: boolean
  /** Matching commits, when a search is active. */
  count: number | null
  inputRef?: Ref<HTMLInputElement>
  onChange: (value: string) => void
  onMode: (mode: SearchMode) => void
}

export function HistorySearch({ value, mode, searching, count, inputRef, onChange, onMode }: Props) {
  return (
    <div className={`${styles.search} ${value ? styles.active : ''}`}>
      <span className={styles.icon}>{searching ? <Spinner /> : <Icon name="search" size={13} />}</span>
      <input
        ref={inputRef}
        className={styles.input}
        placeholder={HINT[mode]}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
      />
      {value && count !== null && !searching && <span className={styles.count}>{count}</span>}
      {value && (
        <button className={styles.clear} title="Clear (Esc)" onClick={() => onChange('')}>
          <Icon name="close" size={11} />
        </button>
      )}
      <Select className={styles.mode} title="What to search" value={mode} options={MODES} onChange={onMode} />
    </div>
  )
}
