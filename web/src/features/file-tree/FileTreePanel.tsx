import { useState } from 'react'
import { usePaneSize } from '../../lib/usePaneSize'
import { Resizer } from '../../ui/Resizer/Resizer'
import { FileTree } from './FileTree'
import styles from './FileTree.module.css'
import { FileView } from './FileView'

type Props = { repoId: number; sha: string; onPick: (sha: string) => void }

export function FileTreePanel({ repoId, sha, onPick }: Props) {
  const [path, setPath] = useState<string | null>(null)
  const width = usePaneSize('fileTree', 280, 140, 800)
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: width.size, flex: 'none', borderRight: '1px solid var(--border)' }}>
        <FileTree repoId={repoId} sha={sha} selected={path} onSelect={setPath} />
      </div>
      <Resizer axis="x" onDrag={width.drag} onDone={width.save} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {path ? <FileView repoId={repoId} sha={sha} path={path} onPick={onPick} /> : <div className={styles.error}>Pick a file.</div>}
      </div>
    </div>
  )
}
