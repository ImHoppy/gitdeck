import styles from './Stats.module.css'

const SHOWN = 12
const fmt = new Intl.NumberFormat()

/** Tracked files by type, largest first; the long tail folds into "other". */
export function ExtensionsChart({ extensions }: { extensions: [string, number][] }) {
  const rest = extensions.slice(SHOWN).reduce((s, [, n]) => s + n, 0)
  const rows: [string, number][] = [...extensions.slice(0, SHOWN), ...(rest ? [['other', rest] as [string, number]] : [])]
  const max = Math.max(1, ...rows.map(([, n]) => n))
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>Files by type</figcaption>
      <div className={styles.hbars}>
        {rows.map(([ext, n]) => (
          <div key={ext || '(none)'} className={styles.hrow} title={`${fmt.format(n)} ${ext ? `.${ext}` : 'without extension'} files`}>
            <span className={styles.hlabel}>{ext === 'other' ? 'other' : ext ? `.${ext}` : '(none)'}</span>
            <span className={styles.htrack}>
              <span className={styles.hfill} style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className={styles.hvalue}>{fmt.format(n)}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}
