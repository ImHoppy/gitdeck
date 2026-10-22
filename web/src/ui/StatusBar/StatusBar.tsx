import type { ShownItem } from '../../lib/statusBar'
import { Icon } from '../Icon/Icon'
import { Spinner } from '../Spinner/Spinner'
import styles from './StatusBar.module.css'

type Props = { items: ShownItem[]; onClick: (id: string, at: { x: number; y: number }) => void }

const byOrder = (a: ShownItem, b: ShownItem) => (b.order ?? 0) - (a.order ?? 0)

/** The line at the bottom of the window: settings and the repo's state left, background work right. */
export function StatusBar({ items, onClick }: Props) {
  const left = items.filter((i) => i.side === 'left').sort(byOrder)
  // the highest order sits at the far right
  const right = items.filter((i) => i.side === 'right').sort(byOrder).reverse()
  const entry = (i: ShownItem) => {
    const body = (
      <>
        {i.tone === 'busy' ? <Spinner /> : i.icon && <Icon name={i.icon} size={12} />}
        {i.text && <span className={styles.text}>{i.text}</span>}
      </>
    )
    const cls = `${styles.item} ${i.tone && i.tone !== 'normal' ? styles[i.tone] : ''}`
    return i.clickable ? (
      <button
        key={i.id}
        className={cls}
        title={i.title}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onClick(i.id, { x: r.left, y: r.top })
        }}
      >
        {body}
      </button>
    ) : (
      <span key={i.id} className={cls} title={i.title}>
        {body}
      </span>
    )
  }
  return (
    <footer className={styles.bar}>
      <div className={styles.side}>{left.map(entry)}</div>
      <div className={`${styles.side} ${styles.right}`}>{right.map(entry)}</div>
    </footer>
  )
}
