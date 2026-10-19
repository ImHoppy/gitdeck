import type { ReactNode } from 'react'
import styles from './WorkspaceTree.module.css'

type Props = {
  depth: number
  expanded: boolean | null
  selected?: boolean
  onToggle: () => void
  onClick?: () => void
  onContextMenu?: (at: { x: number; y: number }) => void
  children: ReactNode
}

const INDENT_PX = 14

export function TreeRow({ depth, expanded, selected, onToggle, onClick, onContextMenu, children }: Props) {
  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      style={{ paddingLeft: depth * INDENT_PX }}
      onClick={onClick ?? onToggle}
      onContextMenu={
        onContextMenu &&
        ((e) => {
          e.preventDefault()
          onContextMenu({ x: e.clientX, y: e.clientY })
        })
      }
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
