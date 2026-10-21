import { type ReactNode, useMemo, useState } from 'react'
import { longPress } from '../../lib/longPress'
import { buildPathTree, type FlatNode, flattenPathTree, type PathNode } from '../../lib/pathTree'
import type { ChangedFile, ChangeKind } from '../../protocol/types'
import { Chevron } from '../../ui/Chevron/Chevron'
import { Icon } from '../../ui/Icon/Icon'
import { VirtualList } from '../../ui/VirtualList/VirtualList'
import styles from './Diff.module.css'

const ICON: Record<ChangeKind, string> = {
  added: '+',
  modified: '✎',
  deleted: '−',
  renamed: '→',
  copied: '⧉',
  typeChanged: 'T',
  unmerged: '✖',
  untracked: '?',
}

const ROW_HEIGHT = 20

export type FileAction = {
  label: ReactNode
  title: string
  run: (files: ChangedFile[]) => void
  /** Another tooltip for these files, e.g. discard on deleted files is a restore. */
  titleFor?: (files: ChangedFile[]) => string | null
}

export type FileListMode = 'list' | 'tree'

type Props = {
  files: ChangedFile[]
  selected: string | null
  onSelect: (f: ChangedFile) => void
  onOpen?: (f: ChangedFile) => void
  mode?: FileListMode
  /** Shown on hover; on a folder they run for every file below it. */
  actions?: FileAction[]
  /** Right-click or long press on a file, or on a folder for every file below it. */
  onContextMenu?: (files: ChangedFile[], at: { x: number; y: number }, folder?: string) => void
}

function leaves(node: PathNode<ChangedFile>): ChangedFile[] {
  return node.kind === 'leaf' ? [node.item] : node.children.flatMap(leaves)
}

export function FileList({ files, selected, onSelect, onOpen, mode = 'list', actions = [], onContextMenu }: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const tree = useMemo(() => (mode === 'tree' ? buildPathTree(files, (f) => f.path) : null), [files, mode])

  if (files.length === 0) return <div className={styles.empty}>No files</div>

  const actionButtons = (of: () => ChangedFile[]) =>
    actions.map((a) => {
      const title = a.titleFor?.(of()) ?? a.title
      return (
      <button
        key={a.title}
        className={styles.action}
        title={title}
        onClick={(e) => {
          e.stopPropagation()
          a.run(of())
        }}
      >
        {a.label}
      </button>
      )
    })

  const menu = (of: () => ChangedFile[], pick?: () => void, folder?: string) =>
    onContextMenu
      ? {
          onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault()
            pick?.()
            onContextMenu(of(), { x: e.clientX, y: e.clientY }, folder)
          },
          ...longPress((at) => {
            pick?.()
            onContextMenu(of(), at, folder)
          }),
        }
      : {}

  const fileRow = (f: ChangedFile, label: string, depth: number) => (
    <div
      {...menu(() => [f], () => onSelect(f))}
      className={`${styles.file} ${f.path === selected ? styles.selected : ''}`}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={() => onSelect(f)}
      onDoubleClick={() => onOpen?.(f)}
      title={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
    >
      <span className={`${styles.icon} ${styles[f.kind]}`}>{ICON[f.kind]}</span>
      <span className={mode === 'tree' ? styles.name : styles.path}>{label}</span>
      {actionButtons(() => [f])}
    </div>
  )

  const toggle = (path: string) => {
    const next = new Set(collapsed)
    if (!next.delete(path)) next.add(path)
    setCollapsed(next)
  }

  const rows: FlatNode<ChangedFile>[] = tree
    ? flattenPathTree(tree, collapsed)
    : files.map((f) => ({ node: { kind: 'leaf', name: f.path, path: f.path, item: f }, depth: 0 }))

  const at = rows.findIndex((r) => r.node.kind === 'leaf' && r.node.path === selected)

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    for (let i = at + step; i >= 0 && i < rows.length; i += step) {
      const { node } = rows[i]
      if (node.kind === 'leaf') return onSelect(node.item)
    }
  }

  return (
    <div className={styles.files} tabIndex={0} onKeyDown={onKeyDown}>
      <VirtualList
        count={rows.length}
        rowHeight={ROW_HEIGHT}
        scrollTo={at < 0 ? null : at}
        renderRow={(i) => {
          const { node, depth } = rows[i]
          if (node.kind === 'leaf') return fileRow(node.item, node.name, depth)
          return (
            <div
              {...menu(() => leaves(node), undefined, node.path)}
              className={`${styles.file} ${styles.dir}`}
              style={{ paddingLeft: 2 + depth * 14 }}
              onClick={() => toggle(node.path)}
              title={node.path}
            >
              <Chevron open={!collapsed.has(node.path)} />
              <Icon name="folder" size={13} />
              <span className={styles.name}>{node.name}</span>
              {actionButtons(() => leaves(node))}
            </div>
          )
        }}
      />
    </div>
  )
}
