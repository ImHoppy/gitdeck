import { type ReactNode, useEffect } from 'react'
import { clickStatusItem, useStatusItems } from '../lib/statusBar'
import { StatusBar } from '../ui/StatusBar/StatusBar'
import styles from './App.module.css'

const BAR_HEIGHT = '22px'

export function Shell({ children }: { children: ReactNode }) {
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
