import { Spinner } from '../../ui/Spinner/Spinner'
import { useState } from 'react'
import type { TreeEntry } from '../../protocol/types'
import { Chevron } from '../../ui/Chevron/Chevron'
import styles from './FileTree.module.css'
import { useGitData } from './useGitData'

type Props = { repoId: number; sha: string; selected: string | null; onSelect: (path: string) => void }

export function FileTree(props: Props) {
  return (
    <div className={styles.tree}>
      <Dir {...props} dir="" depth={0} />
    </div>
  )
}

function Dir({ repoId, sha, dir, depth, selected, onSelect }: Props & { dir: string; depth: number }) {
  const { data, error } = useGitData<TreeEntry[]>('tree.list', { id: repoId, sha, dir })
  if (error) return <div className={styles.error}>{error}</div>
  if (!data) return <div className={styles.row} style={{ paddingLeft: 8 + depth * 14 }}>
        <Spinner />
      </div>
  return (
    <>
      {data.map((e) => {
        const path = dir ? `${dir}/${e.name}` : e.name
        return e.kind === 'tree' ? (
          <Folder key={path} name={e.name} depth={depth}>
            <Dir repoId={repoId} sha={sha} dir={path} depth={depth + 1} selected={selected} onSelect={onSelect} />
          </Folder>
        ) : (
          <div
            key={path}
            className={`${styles.row} ${path === selected ? styles.selected : ''}`}
            style={{ paddingLeft: 22 + depth * 14 }}
            onClick={() => e.kind === 'blob' && onSelect(path)}
            title={e.kind === 'commit' ? 'submodule' : `${e.size ?? 0} bytes`}
          >
            {e.kind === 'commit' ? `${e.name} ⧉` : e.name}
          </div>
        )
      })}
    </>
  )
}

function Folder({ name, depth, children }: { name: string; depth: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className={styles.row} style={{ paddingLeft: 6 + depth * 14 }} onClick={() => setOpen(!open)}>
        <Chevron open={open} /> {name}
      </div>
      {open && children}
    </>
  )
}
