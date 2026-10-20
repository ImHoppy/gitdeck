import { useEffect, useState } from 'react'
import type { ChangedFile, Patch } from '../../protocol/types'
import { Dialog } from '../../ui/Dialog/Dialog'
import { DiffViewer } from '../../ui/DiffViewer/DiffViewer'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Menu, type MenuItem } from '../../ui/Menu/Menu'
import { parseDiff } from '../../lib/diffLines'
import styles from './Diff.module.css'
import { type LineMode, useLineStaging } from './useLineStaging'
import { useRepoTools } from '../repo-actions'

const EMPTY: Set<number> = new Set()

type Props = {
  repoId: number
  file: ChangedFile
  patch: Patch
  side: 'worktree' | 'index' | null
}

export function PatchView({ repoId, file, patch, side }: Props) {
  // tied to the diff it was made on: a new diff means new line indices
  const [picked, setPicked] = useState<{ diffId: string; lines: Set<number> } | null>(null)
  const selected = picked?.diffId === patch.diffId ? picked.lines : EMPTY
  const setSelected = (lines: Set<number>) => setPicked({ diffId: patch.diffId, lines })
  const [confirmReset, setConfirmReset] = useState(false)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number; line: number } | null>(null)
  const tools = useRepoTools(repoId)
  const staging = useLineStaging(repoId)

  const run = async (mode: LineMode) => {
    if (selected.size === 0 || staging.busy) return
    if (await staging.apply(file, mode, patch.diffId, selected)) setSelected(new Set())
  }

  useEffect(() => {
    if (!side) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (side === 'worktree' && key === 's') void run('stage')
      if (side === 'index' && key === 'u') void run('unstage')
      if (side === 'worktree' && key === 'r' && selected.size > 0) setConfirmReset(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const none = selected.size === 0 || staging.busy

  const copySelected = () => {
    const lines = parseDiff(patch.text)
    const text = [...selected].sort((a, b) => a - b).map((i) => lines[i]?.text ?? '').join('\n')
    void navigator.clipboard?.writeText(text)
  }

  const menuItems = (): MenuItem[] => {
    const items: MenuItem[] = []
    if (side === 'worktree') {
      items.push({ key: 'stage', label: 'Stage selected lines', icon: 'pull', disabled: none, onSelect: () => void run('stage') })
      items.push({ key: 'reset', label: 'Reset selected lines…', icon: 'restore', danger: true, disabled: none, onSelect: () => setConfirmReset(true) })
    }
    if (side === 'index') {
      items.push({ key: 'unstage', label: 'Unstage selected lines', icon: 'push', disabled: none, onSelect: () => void run('unstage') })
    }
    if (items.length) items.push('separator')
    items.push({ key: 'copy', label: 'Copy selected lines', icon: 'copy', disabled: selected.size === 0, onSelect: copySelected })
    const l = menuAt ? parseDiff(patch.text)[menuAt.line] : undefined
    const at = l && 'newNo' in l ? (l.newNo ?? l.oldNo) : null
    if (at !== null && file.kind !== 'deleted') {
      items.push({ key: 'editor', label: `Open in editor at line ${at}`, icon: 'editor', onSelect: () => void tools.openInEditor(file.path, at) })
    }
    return items
  }
  return (
    <div className={styles.patchView}>
      {side && (
        <div className={styles.lineBar}>
          {side === 'worktree' && (
            <>
              <IconButton title="Stage selected lines (S)" disabled={none} onClick={() => void run('stage')}>
                Stage lines
              </IconButton>
              <IconButton title="Reset selected lines (R)" disabled={none} onClick={() => setConfirmReset(true)}>
                Reset lines
              </IconButton>
            </>
          )}
          {side === 'index' && (
            <IconButton title="Unstage selected lines (U)" disabled={none} onClick={() => void run('unstage')}>
              Unstage lines
            </IconButton>
          )}
          <span className={styles.hint}>
            {selected.size > 0 ? `${selected.size} lines selected` : 'click, shift-click or drag to pick lines'}
          </span>
          {staging.error && <span className={styles.error}>{staging.error}</span>}
        </div>
      )}
      <div className={styles.patchBody}>
        <DiffViewer
          patch={patch.text}
          path={file.path}
          selected={side ? selected : undefined}
          onSelect={side ? setSelected : undefined}
          onContextMenu={side ? (line, at) => setMenuAt({ ...at, line }) : undefined}
        />
      </div>
      {menuAt && <Menu items={menuItems()} at={menuAt} onClose={() => setMenuAt(null)} />}
      {confirmReset && (
        <Dialog
          title="Reset selected lines?"
          actions={
            <>
              <IconButton title="Keep the lines" onClick={() => setConfirmReset(false)}>
                Cancel
              </IconButton>
              <IconButton
                title="Throw the selected changes away"
                onClick={() => {
                  setConfirmReset(false)
                  void run('reset')
                }}
              >
                Reset
              </IconButton>
            </>
          }
        >
          The selected changes in {file.path} will be lost.
        </Dialog>
      )}
    </div>
  )
}
