import { useEffect, useState } from 'react'
import { DiffPanel } from '../features/diff'
import { useServerInfo } from '../features/settings'
import { useWorkspace } from '../features/workspace-tree'
import { relativeTime } from '../lib/relativeTime'
import { usePaneSize } from '../lib/usePaneSize'
import { gitd } from '../protocol/client'
import { Avatar } from '../ui/Avatar/Avatar'
import { Resizer } from '../ui/Resizer/Resizer'
import { Spinner } from '../ui/Spinner/Spinner'
import { VirtualList } from '../ui/VirtualList/VirtualList'
import styles from './FileHistory.module.css'

type FileCommit = { sha: string; parent: string | null; author: string; email: string; time: number; subject: string; path: string }

type Props = { path: string; repoId: number; workspace: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Every commit that changed one file, following renames, with that file's change (`?history=`). */
export function FileHistoryWindow({ path, repoId, workspace: wsName }: Props) {
  const { workspace, error, open } = useWorkspace()
  useServerInfo()
  useEffect(() => {
    void open(wsName)
  }, [open, wsName])
  const ready = workspace?.repos.some((r) => r.id === repoId) ?? false
  const [commits, setCommits] = useState<FileCommit[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [picked, setPicked] = useState(0)
  const width = usePaneSize('fileHistory', 420, 200, 900)

  useEffect(() => {
    if (!ready) return
    gitd.call<FileCommit[]>('log.file', { id: repoId, path }).then(setCommits, (e: Error) => setFailed(e.message))
  }, [ready, repoId, path])
  useEffect(() => {
    document.title = `History · ${path.split('/').pop()}`
  }, [path])

  const c = commits?.[picked]
  if (error ?? failed) return <div className={styles.empty}>{error ?? failed}</div>
  if (!commits) return <div className={styles.empty}><Spinner /> Reading the history of {path}…</div>
  if (commits.length === 0) return <div className={styles.empty}>No commit changed {path}.</div>
  return (
    <div className={styles.window}>
      <div className={styles.list} style={{ width: width.size }}>
        <div className={styles.title} title={path}>
          {commits.length} commits · {path}
        </div>
        <VirtualList
          count={commits.length}
          rowHeight={40}
          scrollTo={picked}
          renderRow={(i) => {
            const k = commits[i]
            return (
              <div className={`${styles.row} ${i === picked ? styles.selected : ''}`} onClick={() => setPicked(i)} title={`${k.sha}\n${k.path}`}>
                <Avatar name={k.author} email={k.email} size={20} />
                <span className={styles.text}>
                  <span className={styles.subject}>{k.subject}</span>
                  <span className={styles.meta}>
                    {k.author} · {relativeTime(k.time)} · {k.sha.slice(0, 8)}
                    {k.path !== path && ` · was ${k.path}`}
                  </span>
                </span>
              </div>
            )
          }}
        />
      </div>
      <Resizer axis="x" onDrag={width.drag} onDone={width.save} />
      <div className={styles.diff}>
        {c && (
          <DiffPanel
            key={c.sha}
            repoId={repoId}
            target={{ kind: 'commit', sha: c.sha, parent: c.parent }}
            title={`${c.sha.slice(0, 8)}: ${c.subject}`}
            initialQuery={`^${escape(c.path)}$`}
          />
        )}
      </div>
    </div>
  )
}
