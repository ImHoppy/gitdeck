import type { ReactNode, RefObject } from 'react'
import { Icon, type IconName } from '../Icon/Icon'
import { Popover } from '../Popover/Popover'
import styles from './Menu.module.css'

export type MenuItem =
  | { key: string; label: ReactNode; icon?: IconName; checked?: boolean; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | { key: string; heading: string }
  | 'separator'

type Props = {
  items: MenuItem[]
  /** A point (context menu) or the element the menu drops from. */
  at: { x: number; y: number } | DOMRect
  onClose: () => void
  /** Clicks here don't count as outside, e.g. the button that toggles the menu. */
  owner?: RefObject<HTMLElement | null>
}

export function Menu({ items, at, onClose, owner }: Props) {
  return (
    <Popover at={at} onClose={onClose} owner={owner} className={styles.menu} role="menu">
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={`sep${i}`} className={styles.separator} />
        ) : 'heading' in item ? (
          <div key={item.key} className={styles.heading}>
            {item.heading}
          </div>
        ) : (
          <div
            key={item.key}
            role="menuitem"
            aria-disabled={item.disabled}
            className={`${styles.item} ${item.danger ? styles.danger : ''} ${item.disabled ? styles.disabled : ''}`}
            onClick={() => {
              if (item.disabled) return
              onClose()
              item.onSelect()
            }}
          >
            <span className={styles.check}>{item.checked ? '✓' : item.icon ? <Icon name={item.icon} size={13} /> : ''}</span>
            {item.label}
          </div>
        ),
      )}
    </Popover>
  )
}
