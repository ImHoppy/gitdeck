import { useState } from 'react'
import type { TreeNode } from './model'
import { rollup } from './model'
import { RepoBadges } from './RepoBadges'
import { TreeRow } from './TreeRow'
import styles from './WorkspaceTree.module.css'

type Props = {
  node: TreeNode
  depth: number
  selectedId: number | null
  onSelect: (repoId: number) => void
}

export function TreeNodeView({ node, depth, selectedId, onSelect }: Props) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const toggle = () => setExpanded((e) => !e)

  const label =
    node.kind === 'folder' ? (
      <span className={styles.folder}>{node.name} ›</span>
    ) : (
      <>
        <span className={styles.name}>{node.repo.name}</span>
        <span className={styles.head}>{headLabel(node)}</span>
        <span className={styles.badges}>
          <RepoBadges repo={node.repo} />
        </span>
      </>
    )

  return (
    <>
      <TreeRow
        depth={depth}
        expanded={hasChildren ? expanded : null}
        selected={node.kind === 'repo' && node.repo.id === selectedId}
        onToggle={toggle}
        onClick={node.kind === 'repo' ? () => onSelect(node.repo.id) : undefined}
      >
        {label}
        {hasChildren && !expanded && <CollapsedRollup node={node} />}
      </TreeRow>
      {expanded &&
        node.children.map((child) => (
          <TreeNodeView key={child.key} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
        ))}
    </>
  )
}

function headLabel(node: TreeNode & { kind: 'repo' }) {
  const head = node.repo.state?.head
  if (!head) return ''
  return head.kind === 'detached' ? `(${head.sha.slice(0, 7)})` : `(${head.name})`
}

function CollapsedRollup({ node }: { node: TreeNode }) {
  const r = rollup(node.children)
  const parts = [r.behind && `${r.behind} behind`, r.ahead && `${r.ahead} ahead`, r.dirty && `${r.dirty} dirty`]
  const text = parts.filter(Boolean).join(', ')
  return text ? <span className={styles.rollup}>{text} below</span> : null
}
