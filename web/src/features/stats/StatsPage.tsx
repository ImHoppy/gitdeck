import { relativeTime } from '../../lib/relativeTime'
import { Spinner } from '../../ui/Spinner/Spinner'
import { AuthorsTable } from './AuthorsTable'
import { ExtensionsChart } from './ExtensionsChart'
import { MonthChart } from './MonthChart'
import styles from './Stats.module.css'
import { useStats } from './useStats'

const fmt = new Intl.NumberFormat()

/** Like Git Extensions' statistics: totals, activity over time, contributors, file types. */
export function StatsPage({ repoId, name }: { repoId: number; name: string }) {
  const { stats, error } = useStats(repoId)
  if (error) return <div className={styles.empty}>{error}</div>
  if (!stats) return <div className={styles.empty}><Spinner /> Reading the history…</div>
  if (stats.commits === 0) return <div className={styles.empty}>{name} has no commits yet.</div>

  const days = stats.first && stats.last ? Math.max(1, Math.round((stats.last - stats.first) / 86400)) : 0
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{name} statistics</h1>
      <div className={styles.tiles}>
        <Tile value={fmt.format(stats.commits)} label="commits" hint="merges not counted" />
        <Tile value={fmt.format(stats.authors.length)} label="contributors" />
        <Tile value={fmt.format(stats.files)} label="tracked files" />
        <Tile value={`+${fmt.format(stats.added)}`} label="lines added" />
        <Tile value={`−${fmt.format(stats.removed)}`} label="lines removed" />
        <Tile value={fmt.format(days)} label="days of history" hint={stats.first ? `since ${relativeTime(stats.first)}` : undefined} />
      </div>
      <MonthChart months={stats.months} />
      <div className={styles.columns}>
        <AuthorsTable authors={stats.authors} total={stats.commits} />
        <ExtensionsChart extensions={stats.extensions} />
      </div>
    </div>
  )
}

function Tile({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className={styles.tile} title={hint}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}
