import type { ReactNode } from 'react'
import type { PrDetail } from '../../protocol/github'
import { Button } from '../../ui/Button/Button'
import { DropButton } from '../../ui/DropButton/DropButton'
import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'
import type { MenuItem } from '../../ui/Menu/Menu'
import { ChecksMark, ReviewMark, StatePill } from './PrBadges'
import type { PullsTab } from './prNav'
import styles from './PullRequests.module.css'

type At = { x: number; y: number }

type Props = {
  detail: PrDetail
  /** Shown for a PR from outside the workspace. */
  outside: boolean
  onBack?: () => void
  /** "Switch to this branch", "Switch back to main"…; null when there is no clone. */
  switchButton: { label: string; title: string; disabled: boolean; run: () => void } | null
  rebaseMenu: MenuItem[] | null
  merge: { disabled: boolean; title: string; run: () => void } | null
  moreMenu: MenuItem[]
  onMenu: (items: MenuItem[], at: At) => void
  tab: PullsTab
  onTab: (t: PullsTab) => void
  busy: ReactNode
}

const TABS: [PullsTab, string][] = [
  ['conversation', 'Conversation'],
  ['commits', 'Commits'],
  ['files', 'Files'],
  ['checks', 'Checks'],
]

export function PrHeader({ detail: d, outside, onBack, switchButton, rebaseMenu, merge, moreMenu, onMenu, tab, onTab, busy }: Props) {
  const count = (t: PullsTab) => (t === 'commits' ? ` (${d.commits.length})` : t === 'files' ? ` (${d.files.length})` : '')
  return (
    <div className={styles.header}>
      <div className={styles.headTitle}>
        {onBack && (
          <IconButton title="Back to the list" onClick={onBack}>
            <Icon name="back" />
          </IconButton>
        )}
        <StatePill pr={d} />
        <strong>
          {d.title} <span className={styles.muted}>#{d.number}</span>
        </strong>
      </div>
      <div className={styles.headMeta}>
        <span className={styles.branch}>{d.isCrossRepository && d.headRepo ? `${d.headRepo.owner}:` : ''}{d.headRefName}</span>
        <span>→</span>
        <span className={styles.branch}>{d.baseRefName}</span>
        <span>· {d.author}</span>
        <ChecksMark checks={d.checks} />
        <ReviewMark pr={d} />
        <span className={styles.good}>+{d.additions}</span>
        <span className={styles.bad}>−{d.deletions}</span>
        {d.labels.map((l) => (
          <span key={l.name} className={styles.label} style={{ borderColor: `#${l.color}` }}>{l.name}</span>
        ))}
        {outside && <span className={styles.outside}>not in workspace</span>}
      </div>
      <div className={styles.headActions}>
        {switchButton && (
          <IconButton title={switchButton.title} disabled={switchButton.disabled} onClick={switchButton.run}>
            <Icon name="checkout" /> {switchButton.label}
          </IconButton>
        )}
        {rebaseMenu && <DropButton icon="history" label="Rebase" title="Keep the branch current" onOpen={(at) => onMenu(rebaseMenu, at)} />}
        {merge && (
          <span className={styles.merge}>
            <Button title={merge.title} good disabled={merge.disabled} onClick={merge.run}>
              <Icon name="merge" /> Merge…
            </Button>
          </span>
        )}
        <IconButton title="Open on GitHub" onClick={() => window.open(d.url, '_blank', 'noopener,noreferrer')}>
          GitHub ↗
        </IconButton>
        <DropButton icon="settings" label="" title="More: ready, draft, close, edit" onOpen={(at) => onMenu(moreMenu, at)} />
        {busy}
      </div>
      <div className={styles.prTabs}>
        {TABS.map(([t, label]) => (
          <button key={t} className={tab === t ? styles.activeTab : ''} onClick={() => onTab(t)}>
            {label}
            {count(t)}
          </button>
        ))}
      </div>
    </div>
  )
}
