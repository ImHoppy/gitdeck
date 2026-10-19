import { useMemo, useState } from 'react'
import type { WorkspaceSnapshot } from '../../protocol/types'
import { buildTree, filterAttention, needsAttention } from './model'
import { TreeNodeView } from './TreeNodeView'
import styles from './WorkspaceTree.module.css'

type Props = {
  workspace: WorkspaceSnapshot
  selectedId: number | null
  onSelect: (repoId: number) => void
  onRefresh: () => void
}

export function WorkspaceTree({ workspace, selectedId, onSelect, onRefresh }: Props) {
  const [attentionOnly, setAttentionOnly] = useState(false)
  const tree = useMemo(() => buildTree(workspace.repos), [workspace])
  const visible = attentionOnly ? filterAttention(tree) : tree
  const attentionCount = workspace.repos.filter(needsAttention).length

  return (
    <div className={styles.tree}>
      <div className={styles.header}>
        <strong>{workspace.name}</strong>
        <button onClick={onRefresh} title="Refresh">⟳</button>
        <label className={styles.attention}>
          <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />●{' '}
          {attentionCount} need attention
        </label>
      </div>
      {visible.map((node) => (
        <TreeNodeView key={node.key} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}
