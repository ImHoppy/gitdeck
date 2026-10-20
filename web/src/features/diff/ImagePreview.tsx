import { useState } from 'react'
import type { ChangedFile, DiffTarget } from '../../protocol/types'
import styles from './ImagePreview.module.css'

const IMAGE = /\.(png|jpe?g|gif|webp|bmp|ico|svg|avif)$/i

export const isImage = (path: string) => IMAGE.test(path)

/** The two revisions a diff compares, as `/blob` names them; null where the file has no before. */
function revisions(target: DiffTarget): [string | null, string] {
  if (target.kind === 'worktree') return ['index', 'worktree']
  if (target.kind === 'index') return ['HEAD', 'index']
  return [target.parent, target.sha]
}

const url = (repoId: number, rev: string, path: string) =>
  `/blob?${new URLSearchParams({ repo: String(repoId), rev, path })}`

type Props = { repoId: number; file: ChangedFile; target: DiffTarget }

export function ImagePreview({ repoId, file, target }: Props) {
  const [before, after] = revisions(target)
  const old = file.kind === 'added' || file.kind === 'untracked' ? null : before
  const gone = file.kind === 'deleted'
  return (
    <div className={styles.preview}>
      {old && <Side label={gone ? 'Deleted' : 'Before'} src={url(repoId, old, file.oldPath ?? file.path)} />}
      {!gone && <Side label={old ? 'After' : 'New'} src={url(repoId, after, file.path)} />}
    </div>
  )
}

function Side({ label, src }: { label: string; src: string }) {
  const [size, setSize] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  return (
    <figure className={styles.side}>
      <figcaption>
        {label}
        {size && ` · ${size}`}
      </figcaption>
      {failed ? (
        <div className={styles.missing}>Could not load the image</div>
      ) : (
        <img
          src={src}
          alt={label}
          onLoad={(e) => setSize(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  )
}
