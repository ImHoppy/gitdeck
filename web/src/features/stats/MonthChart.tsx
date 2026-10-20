import { useState } from 'react'
import styles from './Stats.module.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const label = (key: string) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`

/** Commits per month: one series, so one hue and no legend; hover names the month. */
export function MonthChart({ months }: { months: [string, number][] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...months.map(([, n]) => n))
  // a year label under each January, or under the first month when the range starts mid-year
  const ticks = months.map(([k], i) => (i === 0 || k.endsWith('-01') ? k.slice(0, 4) : ''))

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>Commits per month</figcaption>
      <div className={styles.plot}>
        <span className={styles.yMax}>{max}</span>
        <div className={styles.bars} onMouseLeave={() => setHover(null)}>
          {months.map(([key, n], i) => (
            <div key={key} className={styles.slot} onMouseEnter={() => setHover(i)}>
              <div className={`${styles.bar} ${hover === i ? styles.barHover : ''}`} style={{ height: `${(n / max) * 100}%` }} />
              {hover === i && (
                <div className={styles.tooltip} style={i > months.length / 2 ? { right: 0 } : { left: 0 }}>
                  <strong>{n}</strong> commit{n === 1 ? '' : 's'}
                  <span>{label(key)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className={styles.ticks}>
          {ticks.map((t, i) => (
            <span key={months[i][0]}>{t}</span>
          ))}
        </div>
      </div>
    </figure>
  )
}
