import { type ReactNode, useEffect } from 'react'
import { clickStatusItem, useStatusItem, useStatusItems } from '../lib/statusBar'
import { dismissAllToasts, useToastCount } from '../ui/Toast/openToasts'
import { StatusBar } from '../ui/StatusBar/StatusBar'
import styles from './App.module.css'

const BAR_HEIGHT = '22px'

export function Shell({ children }: { children: ReactNode }) {
  const toasts = useToastCount()
  useStatusItem({
    id: 'toasts',
    side: 'right',
    order: 1000,
    icon: 'bell',
    text: toasts ? String(toasts) : undefined,
    title: toasts ? `Clear ${toasts} notification${toasts === 1 ? '' : 's'}` : 'No notifications',
    onClick: toasts ? dismissAllToasts : undefined,
  })
  const items = useStatusItems()
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--status-bar-height', BAR_HEIGHT)
    return () => {
      root.removeProperty('--status-bar-height')
    }
  }, [])
  return (
    <div className={styles.shell}>
      <div className={styles.shellBody}>{children}</div>
      <StatusBar items={items} onClick={clickStatusItem} />
    </div>
  )
}
