import { type MouseEvent, type ReactNode, useMemo, useState } from 'react'
import type { GitRef, Stash } from '../../protocol/types'
import { type RefNode, refTree } from './refTree'
import styles from './RefsPanel.module.css'

export type RefTarget = { kind: 'ref'; ref: GitRef } | { kind: 'stash'; stash: Stash }

type Props = {
  refs: GitRef[]
  stashes: Stash[]
  currentBranch: string | null
  aheadBehind: (ref: GitRef) => string
  onPick: (sha: string) => void
  onContext: (target: RefTarget, at: { x: number; y: number }) => void
}

export function RefsPanel({ refs, stashes, currentBranch, aheadBehind, onPick, onContext }: Props) {
  const branches = useMemo(() => refTree(refs.filter((r) => r.kind === 'branch')), [refs])
  const remotes = useMemo(() => refTree(refs.filter((r) => r.kind === 'remote')), [refs])
  const tags = useMemo(() => refTree(refs.filter((r) => r.kind === 'tag')), [refs])

  const menu = (target: RefTarget) => (e: MouseEvent) => {
    e.preventDefault()
    onContext(target, { x: e.clientX, y: e.clientY })
  }

  const renderNodes = (nodes: RefNode[], depth: number): ReactNode =>
    nodes.map((n) =>
      n.kind === 'folder' ? (
        <Folder key={n.path} name={n.name} depth={depth}>
          {renderNodes(n.children, depth + 1)}
        </Folder>
      ) : (
        <div
          key={`${n.ref.kind}:${n.ref.name}`}
          className={`${styles.row} ${n.ref.name === currentBranch && n.ref.kind === 'branch' ? styles.current : ''}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          title={n.ref.name}
          onClick={() => onPick(n.ref.sha)}
          onContextMenu={menu({ kind: 'ref', ref: n.ref })}
        >
          {n.name}
          <span className={styles.meta}>{aheadBehind(n.ref)}</span>
        </div>
      ),
    )

  return (
    <div className={styles.panel}>
      <Section title={`Branches (${refs.filter((r) => r.kind === 'branch').length})`}>{renderNodes(branches, 1)}</Section>
      <Section title="Remotes" closed>
        {renderNodes(remotes, 1)}
      </Section>
      <Section title={`Tags (${refs.filter((r) => r.kind === 'tag').length})`} closed>
        {renderNodes(tags, 1)}
      </Section>
      <Section title={`Stashes (${stashes.length})`}>
        {stashes.map((s) => (
          <div
            key={s.index}
            className={styles.row}
            style={{ paddingLeft: 20 }}
            title={s.message}
            onClick={() => onPick(s.sha)}
            onContextMenu={menu({ kind: 'stash', stash: s })}
          >
            {s.message}
          </div>
        ))}
      </Section>
    </div>
  )
}

function Section({ title, closed, children }: { title: string; closed?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!closed)
  return (
    <>
      <div className={styles.section} onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {title}
      </div>
      {open && children}
    </>
  )
}

function Folder({ name, depth, children }: { name: string; depth: number; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <div className={`${styles.row} ${styles.folder}`} style={{ paddingLeft: depth * 12 - 4 }} onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {name}/
      </div>
      {open && children}
    </>
  )
}
