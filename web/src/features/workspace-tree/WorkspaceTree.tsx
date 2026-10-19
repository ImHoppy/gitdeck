import { type ReactNode, useMemo, useState } from 'react'
import type { RepoSnapshot, WorkspaceSnapshot } from '../../protocol/types'
import { Icon } from '../../ui/Icon/Icon'
import { buildTree, filterAttention, needsAttention } from './model'
import { TreeNodeView } from './TreeNodeView'
import styles from './WorkspaceTree.module.css'

type Props = {
  workspace: WorkspaceSnapshot
  selectedId: number | null
  onSelect: (repoId: number) => void
  onRefresh: () => void
  picker: ReactNode
  toolbar?: ReactNode
  actions?: (repo: RepoSnapshot) => ReactNode
  onRepoMenu?: (repo: RepoSnapshot, at: { x: number; y: number }) => void
}

export function WorkspaceTree({ workspace, selectedId, onSelect, onRefresh, picker, toolbar, actions, onRepoMenu }: Props) {
  const [attentionOnly, setAttentionOnly] = useState(false)
  const tree = useMemo(() => buildTree(workspace.repos), [workspace])
  const visible = attentionOnly ? filterAttention(tree) : tree
  const attentionCount = workspace.repos.filter(needsAttention).length

  return (
    <div className={styles.tree}>
      <div className={styles.header}>
        {picker}
        <button onClick={onRefresh} title="Refresh">
          <Icon name="refresh" size={12} />
        </button>
        {toolbar}
        <label className={styles.attention}>
          <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />●{' '}
          {attentionCount} need attention
        </label>
      </div>
      {visible.map((node) => (
        <TreeNodeView key={node.key} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} actions={actions} onRepoMenu={onRepoMenu} />
      ))}
    </div>
  )
}
