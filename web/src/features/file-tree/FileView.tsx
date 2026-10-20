import { useMemo, useState } from 'react'
import { relativeTime } from '../../lib/relativeTime'
import { useHighlight } from '../../lib/useHighlight'
import type { BlameLine, FileContent } from '../../protocol/types'
import { VirtualList } from '../../ui/VirtualList/VirtualList'
import styles from './FileTree.module.css'
import { useGitData } from './useGitData'

const LINE = 18

type Props = { repoId: number; sha: string; path: string; onPick: (sha: string) => void; onHistory?: (path: string) => void }

export function FileView({ repoId, sha, path, onPick, onHistory }: Props) {
  const [blame, setBlame] = useState(false)
  const content = useGitData<FileContent>('file.show', { id: repoId, sha, path })
  const blamed = useGitData<BlameLine[]>('file.blame', blame ? { id: repoId, sha, path } : null)
  const texts = useMemo(
    () => (blame ? (blamed.data ?? []).map((l) => l.text) : (content.data?.text.split('\n') ?? [])),
    [blame, blamed.data, content.data],
  )
  const html = useHighlight(path, texts)

  const header = (
    <div className={styles.viewBar}>
      <span className={styles.path}>{path}</span>
      <label>
        <input type="checkbox" checked={blame} onChange={(e) => setBlame(e.target.checked)} /> Blame
      </label>
      {onHistory && (
        <button className={styles.historyButton} title="Every commit that changed this file (new window)" onClick={() => onHistory(path)}>
          History
        </button>
      )}
    </div>
  )

  const error = content.error ?? blamed.error
  if (error) return <div className={styles.view}>{header}<div className={styles.error}>{error}</div></div>
  if (!content.data || (blame && !blamed.data)) return <div className={styles.view}>{header}<div className={styles.error}>Loading…</div></div>
  if (content.data.binary) return <div className={styles.view}>{header}<div className={styles.error}>Binary file</div></div>

  const lines = blame ? blamed.data! : content.data.text.split('\n')
  return (
    <div className={styles.view}>
      {header}
      <div className={styles.code}>
        <VirtualList
          count={lines.length}
          rowHeight={LINE}
          renderRow={(i) => {
            const l = lines[i]
            if (typeof l === 'string') {
              return (
                <div className={styles.line}>
                  <span className={styles.no}>{i + 1}</span>
                  <Code html={html?.[i]} text={l} />
                </div>
              )
            }
            const first = i === 0 || (lines[i - 1] as BlameLine).sha !== l.sha
            return (
              <div className={`${styles.line} ${first ? styles.blameStart : ''}`}>
                <span className={styles.blame} title={`${l.summary}\n${l.author}`} onClick={() => onPick(l.sha)}>
                  {first ? `${l.sha.slice(0, 7)} ${l.author} ${relativeTime(l.time)}` : ''}
                </span>
                <span className={styles.no}>{i + 1}</span>
                <Code html={html?.[i]} text={l.text} />
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}

function Code({ html, text }: { html: string | undefined; text: string }) {
  return html === undefined ? <span>{text}</span> : <span dangerouslySetInnerHTML={{ __html: html }} />
}
