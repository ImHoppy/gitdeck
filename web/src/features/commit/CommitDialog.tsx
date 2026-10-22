import { useEffect, useMemo, useRef, useState } from 'react'
import { loadSetting, saveSetting } from '../../lib/storedSetting'
import { Toast } from '../../ui/Toast/Toast'
import { useRepoTools } from '../repo-actions'
import type { ChangedFile, DiffTarget } from '../../protocol/types'
import { Icon } from '../../ui/Icon/Icon'
import { Button } from '../../ui/Button/Button'
import { IconButton } from '../../ui/IconButton/IconButton'
import { PageHeader } from '../../ui/PageHeader/PageHeader'
import { useDialogs } from '../../ui/Dialog/useDialogs'
import { Menu, type MenuItem } from '../../ui/Menu/Menu'
import { FileFilter, type FileListMode, ImagePreview, isImage, PatchView, useDiffFiles, useFileFilter, usePatch } from '../diff'
import { ChangeList } from './ChangeList'
import styles from './CommitDialog.module.css'
import { useCommitActions } from './useCommitActions'

const WORKTREE: DiffTarget = { kind: 'worktree' }
const INDEX: DiffTarget = { kind: 'index' }
const MODES = ['tree', 'list'] as const

type Picked = { side: 'worktree' | 'index'; path: string }
type FileMenu = { side: Picked['side']; files: ChangedFile[]; at: { x: number; y: number }; folder?: string }

type Props = {
  repoId: number
  onClose: () => void
  onPush: () => void
  /** Fills its own window instead of floating over the repo view. */
  standalone?: boolean
  onPopOut?: () => void
}

export function CommitDialog({ repoId, onClose, onPush, standalone, onPopOut }: Props) {
  const filter = useFileFilter()
  const unstaged = useDiffFiles(repoId, WORKTREE, filter.code)
  const staged = useDiffFiles(repoId, INDEX, filter.code)
  const { apply } = filter
  const shownUnstaged = useMemo(() => apply(unstaged.files), [apply, unstaged.files])
  const shownStaged = useMemo(() => apply(staged.files), [apply, staged.files])
  const actions = useCommitActions(repoId)
  const dialogs = useDialogs()
  const [picked, setPicked] = useState<Picked | null>(null)
  const [fileMenu, setFileMenu] = useState<FileMenu | null>(null)
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [signOff, setSignOff] = useState(() => loadSetting('signOff', ['1', '0'] as const, '0') === '1')
  const tools = useRepoTools(repoId)
  const { template } = actions
  // the configured commit template starts an empty message, as `git commit` would
  useEffect(() => {
    let live = true
    void template().then((t) => live && t.trim() && setMessage((m) => m || t))
    return () => {
      live = false
    }
  }, [template])
  const [mode, setMode] = useState<FileListMode>(() => loadSetting('fileListMode', MODES, 'tree'))

  const list = picked?.side === 'index' ? staged.files : unstaged.files
  const file: ChangedFile | null = list?.find((f) => f.path === picked?.path) ?? null
  const target = picked?.side === 'index' ? INDEX : WORKTREE
  const patch = usePatch(repoId, target, file, list)

  const paths = (files: ChangedFile[] | null) => (files ?? []).map((f) => f.path)
  // the lists move at once; git and the reload that follows only confirm it
  const move = (files: ChangedFile[], from: typeof unstaged, to: typeof staged, kind: (f: ChangedFile) => ChangedFile['kind']) => {
    const gone = new Set(paths(files))
    from.update((l) => l && l.filter((f) => !gone.has(f.path)))
    to.update((l) => l && [...l.filter((f) => !gone.has(f.path)), ...files.map((f) => ({ ...f, kind: kind(f) }))].sort((a, b) => a.path.localeCompare(b.path)))
  }
  const reload = () => {
    unstaged.reload()
    staged.reload()
  }
  const stage = (files: ChangedFile[]) => {
    move(files, unstaged, staged, (f) => (f.kind === 'untracked' ? 'added' : f.kind))
    void actions.stage(paths(files)).then((ok) => ok || reload())
  }
  const unstage = (files: ChangedFile[]) => {
    move(files, staged, unstaged, (f) => (f.kind === 'added' ? 'untracked' : f.kind))
    void actions.unstage(paths(files)).then((ok) => ok || reload())
  }
  const canCommit = !actions.busy && message.trim() !== '' && ((staged.files?.length ?? 0) > 0 || amend)

  // Git Extensions keys on the picked file: S stage, U unstage, R reset; the next file gets picked
  const fileKeys = useRef<(key: string) => boolean>(() => false)
  fileKeys.current = (key) => {
    if (!file || !picked || !list) return false
    const next = list[list.indexOf(file) + 1] ?? list[list.indexOf(file) - 1]
    const pickNext = () => setPicked(next ? { side: picked.side, path: next.path } : null)
    if (key === 's' && picked.side === 'worktree') {
      stage([file])
      pickNext()
    } else if (key === 'u' && picked.side === 'index') {
      unstage([file])
      pickNext()
    } else if (key === 'r' && picked.side === 'worktree') void discard([file])
    else return false
    return true
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')
      const covered = document.querySelector('[role="menu"], [aria-modal="true"]')
      if (!typing && !covered && !e.ctrlKey && !e.altKey && !e.metaKey && fileKeys.current(e.key.toLowerCase())) {
        e.preventDefault()
        return
      }
      if (e.key === 'F5') {
        // new file lists also reload the open diff; in its own window this beats reloading the page
        e.preventDefault()
        unstaged.reload()
        staged.reload()
        return
      }
      // a menu or a confirmation on top takes the Escape for itself
      if (e.key !== 'Escape' || document.querySelector('[role="menu"], [aria-modal="true"]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, unstaged.reload, staged.reload])

  const switchMode = () => {
    const next = mode === 'tree' ? 'list' : 'tree'
    setMode(next)
    saveSetting('fileListMode', next)
  }

  const discard = async (files: ChangedFile[]) => {
    if (files.length === 0) return
    const fresh = files.filter((f) => f.kind === 'untracked').length
    const what = files.length === 1 ? files[0].path : `${files.length} files`
    if (allDeleted(files)) {
      if (await dialogs.confirm('Restore?', `${what} will be brought back as last committed.`, 'Restore')) await actions.discard(files)
      return
    }
    const body = fresh ? `The changes to ${what} will be lost; ${fresh} new file${fresh === 1 ? '' : 's'} will be deleted.` : `The changes to ${what} will be lost.`
    if (await dialogs.confirm('Discard changes?', body, 'Discard')) await actions.discard(files)
  }

  const ignore = async (files: ChangedFile[], exclude: boolean, folder?: string) => {
    if (files.length === 0) return
    // a folder row: that folder; one file: its path; several files: the folder they share
    const common = folder ? `${folder}/` : files.length === 1 ? files[0].path : commonFolder(files.map((f) => f.path))
    const where = exclude ? '.git/info/exclude (this clone only)' : '.gitignore'
    const pattern = await dialogs.prompt('Ignore', `Pattern to add to ${where} (/ at the start: from the repository root)`, `/${common}`)
    if (pattern) await tools.ignore(pattern, exclude)
  }

  const menuItems = ({ side, files, folder }: FileMenu): MenuItem[] => {
    const one = !folder && files.length === 1 ? files[0] : null
    const staged = side === 'index'
    const items: MenuItem[] = [
      staged
        ? { key: 'unstage', label: 'Unstage', icon: 'push', onSelect: () => unstage(files) }
        : { key: 'stage', label: 'Stage', icon: 'pull', onSelect: () => stage(files) },
      { key: 'difftool', label: 'Open in the diff tool', icon: 'diff', onSelect: () => files.forEach((f) => void tools.diffTool(f.path, { staged })) },
      { key: 'editordiff', label: 'Open diff in editor', icon: 'editor', onSelect: () => files.forEach((f) => void tools.diffTool(f.path, { staged, editor: true })) },
    ]
    if (!staged) {
      items.push(
        allDeleted(files)
          ? { key: 'discard', label: 'Restore…', icon: 'restore', onSelect: () => void discard(files) }
          : { key: 'discard', label: 'Discard changes…', icon: 'restore', danger: true, onSelect: () => void discard(files) },
      )
    }
    items.push('separator')
    if (one) {
      items.push(
        { key: 'editor', label: 'Open in editor', icon: 'editor', disabled: one.kind === 'deleted', onSelect: () => void tools.openInEditor(one.path) },
        { key: 'explorer', label: 'Show in file explorer', icon: 'folder', disabled: one.kind === 'deleted', onSelect: () => void tools.reveal(one.path) },
        { key: 'copy', label: 'Copy path', icon: 'copy', onSelect: () => void navigator.clipboard.writeText(one.path) },
      )
    }
    if (!staged) {
      if (one) items.push('separator')
      items.push(
        { key: 'ignore', label: 'Ignore… (.gitignore)', onSelect: () => void ignore(files, false, folder) },
        { key: 'exclude', label: 'Exclude… (.git/info/exclude)', onSelect: () => void ignore(files, true, folder) },
      )
    }
    return items
  }

  const toggleAmend = async (on: boolean) => {
    setAmend(on)
    if (on && message.trim() === '') setMessage(await actions.lastMessage())
  }

  const commit = async (push: boolean) => {
    if (!canCommit) return
    if (await actions.commit(message, amend, signOff)) {
      setMessage('')
      setAmend(false)
      onClose()
      if (push) onPush()
    }
  }

  const verb = amend ? 'Amend' : 'Commit'
  return (
    <div className={`${styles.backdrop} ${standalone ? styles.standalone : ''}`}>
      <div className={styles.dialog} role="dialog" aria-label="Commit">
        <PageHeader
          title="Commit"
          onClose={onClose}
          tools={<>
            <IconButton title={mode === 'tree' ? 'Show a flat list' : 'Show folders'} onClick={switchMode}>
              <Icon name={mode === 'tree' ? 'list' : 'tree'} size={13} />
            </IconButton>
            {onPopOut && (
              <IconButton title="Open in a new window" onClick={onPopOut}>
                <Icon name="popout" size={12} />
              </IconButton>
            )}
          </>}
        />
        <div className={styles.body}>
          <div className={styles.lists}>
            <FileFilter filter={filter} />
            <ChangeList
              title="Unstaged"
              files={shownUnstaged}
              selected={picked?.side === 'worktree' ? picked.path : null}
              onSelect={(f) => setPicked({ side: 'worktree', path: f.path })}
              onOpen={(f) => stage([f])}
              mode={mode}
              all={[
                { label: <Icon name="restore" size={12} />, title: 'Discard all unstaged changes…', disabled: actions.busy, run: () => void discard(shownUnstaged ?? []) },
                { label: '⇊ stage all', title: 'Stage all', disabled: actions.busy, run: () => stage(shownUnstaged ?? []) },
              ]}
              actions={[
                {
                  label: <Icon name="restore" size={12} />,
                  title: 'Discard changes… (R)',
                  run: (fs) => void discard(fs),
                  titleFor: (fs) => (allDeleted(fs) ? 'Restore…' : null),
                },
                { label: <Icon name="pull" size={12} />, title: 'Stage (S)', run: (fs) => stage(fs) },
              ]}
              onContextMenu={(files, at, folder) => setFileMenu({ side: 'worktree', files, at, folder })}
            />
            <ChangeList
              title="Staged"
              files={shownStaged}
              selected={picked?.side === 'index' ? picked.path : null}
              onSelect={(f) => setPicked({ side: 'index', path: f.path })}
              onOpen={(f) => unstage([f])}
              mode={mode}
              all={[{ label: '⇈ unstage all', title: 'Unstage all', disabled: actions.busy, run: () => unstage(shownStaged ?? []) }]}
              actions={[
                { label: <Icon name="push" size={12} />, title: 'Unstage (U)', run: (fs) => unstage(fs) },
              ]}
              onContextMenu={(files, at, folder) => setFileMenu({ side: 'index', files, at, folder })}
            />
          </div>
          <div className={styles.right}>
            <div className={styles.diff}>
              {file && isImage(file.path) ? (
                <ImagePreview repoId={repoId} file={file} target={target} />
              ) : (
                patch?.patch && file && <PatchView repoId={repoId} file={file} patch={patch.patch} side={picked?.side ?? null} />
              )}
            </div>
            <div className={styles.compose}>
              <div className={styles.buttons}>
                <Button primary title="Commit (Ctrl+Enter)" disabled={!canCommit} onClick={() => void commit(false)}>
                  <Icon name="commit" size={13} /> {verb}
                </Button>
                <Button title="Commit, then push (Ctrl+Shift+Enter)" disabled={!canCommit} onClick={() => void commit(true)}>
                  <Icon name="push" size={13} /> {verb} &amp; push
                </Button>
                <label>
                  <input type="checkbox" checked={amend} onChange={(e) => void toggleAmend(e.target.checked)} /> Amend
                </label>
                <label title="Adds a Signed-off-by line with your name and email">
                  <input
                    type="checkbox"
                    checked={signOff}
                    onChange={(e) => {
                      setSignOff(e.target.checked)
                      saveSetting('signOff', e.target.checked ? '1' : '0')
                    }}
                  />{' '}
                  Sign off
                </label>
              </div>
              <textarea
                className={styles.message}
                placeholder="Commit message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) void commit(e.shiftKey)
                }}
              />
            </div>
            {actions.error && <div className={styles.error}>{actions.error}</div>}
            {dialogs.element}
            {fileMenu && <Menu items={menuItems(fileMenu)} at={fileMenu.at} onClose={() => setFileMenu(null)} />}
            {tools.result && <Toast tone={tools.result.ok ? 'ok' : 'bad'} title={tools.result.text} onDismiss={tools.clear} autoHide={tools.result.ok ? 4000 : undefined} />}
          </div>
        </div>
      </div>
    </div>
  )
}

const allDeleted = (files: ChangedFile[]) => files.length > 0 && files.every((f) => f.kind === 'deleted')

function commonFolder(paths: string[]): string {
  const parts = paths.map((p) => p.split('/').slice(0, -1))
  const first = parts[0] ?? []
  let n = 0
  while (n < first.length && parts.every((p) => p[n] === first[n])) n++
  return first.slice(0, n).join('/') + '/'
}
