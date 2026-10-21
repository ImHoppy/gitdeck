import type { ReactNode } from 'react'
import { longPress } from '../../lib/longPress'
import { Chevron } from '../../ui/Chevron/Chevron'
import styles from './WorkspaceTree.module.css'

type Props = {
  depth: number
  expanded: boolean | null
  selected?: boolean
  onToggle: () => void
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: (at: { x: number; y: number }) => void
  children: ReactNode
}

const INDENT_PX = 14

export function TreeRow({ depth, expanded, selected, onToggle, onClick, onDoubleClick, onContextMenu, children }: Props) {
  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      style={{ paddingLeft: depth * INDENT_PX }}
      onClick={onClick ?? onToggle}
      onDoubleClick={onDoubleClick}
      {...(onContextMenu ? longPress(onContextMenu) : {})}
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
        {expanded !== null && <Chevron open={expanded} />}
      </span>
      {children}
    </div>
  )
}
