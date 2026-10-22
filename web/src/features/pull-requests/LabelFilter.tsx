import { useRef, useState } from 'react'
import type { RepoLabel } from '../../protocol/github'
import { DropButton } from '../../ui/DropButton/DropButton'
import { Popover } from '../../ui/Popover/Popover'
import { Spinner } from '../../ui/Spinner/Spinner'
import styles from './LabelFilter.module.css'

type Props = {
  /** Null while they load. */
  labels: RepoLabel[] | null
  selected: string[]
  noLabel: boolean
  onChange: (labels: string[], noLabel: boolean) => void
  onOpen: () => void
}

function caption(selected: string[], noLabel: boolean) {
  if (noLabel) return 'No labels'
  if (selected.length === 0) return 'Labels'
  return selected.length === 1 ? selected[0] : `${selected.length} labels`
}

/** GitHub's "Filter by labels": several labels mean PRs carrying all of them. */
export function LabelFilter({ labels, selected, noLabel, onChange, onOpen }: Props) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const owner = useRef<HTMLSpanElement>(null)
  const [text, setText] = useState('')
  const words = text.trim().toLowerCase()
  const shown = (labels ?? []).filter((l) => !words || `${l.name} ${l.description}`.toLowerCase().includes(words))
  const has = (name: string) => selected.some((s) => s.toLowerCase() === name.toLowerCase())
  const toggle = (name: string) => onChange(has(name) ? selected.filter((s) => s.toLowerCase() !== name.toLowerCase()) : [...selected, name].sort(), false)

  return (
    <>
      <span ref={owner} className={styles.owner}>
        <DropButton
          icon="tag"
          label={caption(selected, noLabel)}
          title="Filter by labels"
          onOpen={(p) => {
            setAt(at ? null : p)
            onOpen()
          }}
        />
      </span>
      {at && (
        <Popover at={at} onClose={() => setAt(null)} owner={owner} className={styles.panel}>
          <div className={styles.head}>Filter by labels</div>
          <input
            autoFocus
            className={styles.search}
            value={text}
            placeholder="Filter labels"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown[0]) toggle(shown[0].name)
            }}
          />
          <div className={styles.list}>
            {!words && (
              <label className={styles.row}>
                <input type="checkbox" checked={noLabel} onChange={() => onChange([], !noLabel)} />
                <span className={styles.name}>No labels</span>
              </label>
            )}
            {labels === null ? (
              <div className={styles.note}>
                <Spinner /> Loading labels…
              </div>
            ) : shown.length === 0 ? (
              <div className={styles.note}>{labels.length ? 'No label matches.' : 'This repo has no labels.'}</div>
            ) : (
              shown.map((l) => (
                <label key={l.name} className={styles.row} title={l.description || l.name}>
                  <input type="checkbox" checked={has(l.name)} onChange={() => toggle(l.name)} />
                  <span className={styles.dot} style={{ background: `#${l.color}` }} />
                  <span className={styles.text}>
                    <span className={styles.name}>{l.name}</span>
                    {l.description && <span className={styles.description}>{l.description}</span>}
                  </span>
                </label>
              ))
            )}
          </div>
          {(selected.length > 0 || noLabel) && (
            <button className={styles.clear} onClick={() => onChange([], false)}>
              Clear label filter
            </button>
          )}
        </Popover>
      )}
    </>
  )
}
