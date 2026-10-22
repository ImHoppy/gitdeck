import type { ReactNode } from 'react'
import type { ListState } from '../../protocol/github'
import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Select } from '../../ui/Select/Select'
import { Spinner } from '../../ui/Spinner/Spinner'
import type { Scope } from './filter'
import styles from './PullRequests.module.css'

type Props = {
  lead?: ReactNode
  repos: [string, string][]
  repo: string
  onRepo: (repo: string) => void
  state: ListState
  onState: (s: ListState) => void
  scope: Scope
  onScope: (s: Scope) => void
  /** The label filter and the sort, beside the text filter. */
  filters: ReactNode
  filter: string
  onFilter: (text: string) => void
  loading: boolean
  onRefresh: () => void
  onNew: (() => void) | null
  /** Moves the view into a window of its own; absent in that window. */
  pop?: { title: string; run: () => void }
}

const SCOPES: [Scope, string][] = [
  ['mine', 'Mine'],
  ['review', 'Review requested'],
  ['all', 'All'],
]

const STATES: [ListState, string][] = [
  ['open', 'Open'],
  ['closed', 'Closed'],
  ['merged', 'Merged'],
]

export function PrToolbar({ lead, repos, repo, onRepo, state, onState, scope, onScope, filters, filter, onFilter, loading, onRefresh, onNew, pop }: Props) {
  return (
    <div className={styles.toolbar}>
      {lead}
      <Select value={repo} options={repos} onChange={onRepo} title="Repository" />
      <Select value={state} options={STATES} onChange={onState} title="State" />
      <span className={styles.chips}>
        {SCOPES.map(([s, label]) => (
          <button key={s} className={s === scope ? styles.chipOn : ''} onClick={() => onScope(s)}>
            {label}
          </button>
        ))}
      </span>
      {filters}
      <input className={styles.filter} value={filter} placeholder="Filter: title, #number, author, branch" onChange={(e) => onFilter(e.target.value)} />
      <IconButton title="Refresh (F5)" disabled={loading} onClick={onRefresh}>
        {loading ? <Spinner /> : <Icon name="refresh" />}
      </IconButton>
      <span className={styles.spacer} />
      {onNew && (
        <IconButton title="Create a pull request from a branch" onClick={onNew}>
          <Icon name="add" /> New PR
        </IconButton>
      )}
      {pop && (
        <IconButton title={pop.title} onClick={pop.run}>
          <Icon name="popout" />
        </IconButton>
      )}
    </div>
  )
}
