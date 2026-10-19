import { useState } from 'react'
import type { ChangedFile, DiffTarget } from '../../protocol/types'
import styles from './Diff.module.css'
import { FileList } from './FileList'
import { PatchView } from './PatchView'
import { useDiffFiles } from './useDiffFiles'
import { usePatch } from './usePatch'

type Props = { repoId: number; target: DiffTarget; title: string }

export function DiffPanel({ repoId, target, title }: Props) {
  const { files, error } = useDiffFiles(repoId, target)
  const [picked, setPicked] = useState<string | null>(null)
  const file: ChangedFile | null = files?.find((f) => f.path === picked) ?? files?.[0] ?? null
  const patch = usePatch(repoId, target, file, files)

  if (error) return <div className={styles.empty}>{error}</div>
  if (!files) return <div className={styles.empty}>Loading…</div>
  return (
    <div className={styles.panel}>
      <div className={styles.left}>
        <div className={styles.title} title={title}>
          ({files.length}) {title}
        </div>
        <FileList files={files} selected={file?.path ?? null} onSelect={(f) => setPicked(f.path)} />
      </div>
      <div className={styles.right}>
        {patch?.error && <div className={styles.empty}>{patch.error}</div>}
        {patch?.patch && file && (
          <PatchView
            repoId={repoId}
            file={file}
            patch={patch.patch}
            side={target.kind === 'commit' ? null : target.kind}
          />
        )}
      </div>
    </div>
  )
}
