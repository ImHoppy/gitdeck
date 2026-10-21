import type { ReactNode } from 'react'
import { Icon } from '../Icon/Icon'
import { IconButton } from '../IconButton/IconButton'
import styles from './PageHeader.module.css'

type Props = {
  title: ReactNode
  status?: ReactNode
  tools?: ReactNode
  className?: string
  onClose: () => void
}

export function PageHeader({ title, status, tools, className, onClose }: Props) {
  return (
    <header className={`${styles.header} ${className ?? ''}`}>
      <strong className={styles.title}>{title}</strong>
      {status}
      <span className={styles.tools}>
        {tools}
        <IconButton title="Close (Esc)" onClick={onClose}>
          <Icon name="close" size={12} />
        </IconButton>
      </span>
    </header>
  )
}
