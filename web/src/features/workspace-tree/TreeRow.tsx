import type { ReactNode } from 'react'
import styles from './WorkspaceTree.module.css'

type Props = {
  depth: number
  expanded: boolean | null
  selected?: boolean
  onToggle: () => void
  onClick?: () => void
  children: ReactNode
}

const INDENT_PX = 14

export function TreeRow({ depth, expanded, selected, onToggle, onClick, children }: Props) {
  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      style={{ paddingLeft: depth * INDENT_PX }}
      onClick={onClick ?? onToggle}
    >
      <span
        className={styles.twisty}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        {expanded === null ? '' : expanded ? '▾' : '▸'}
      </span>
      {children}
    </div>
  )
}
