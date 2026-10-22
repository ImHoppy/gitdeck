import { Select } from '../../ui/Select/Select'
import { type ReactNode, useEffect, useState } from 'react'
import { commitInWindow, setCommitInWindow } from '../../lib/commitWindow'
import { repoWindowOnDoubleClick, setRepoWindowOnDoubleClick } from '../../lib/repoWindow'
import { pullsInWindow, setPullsInWindow } from '../../lib/pullsWindow'
import { PageHeader } from '../../ui/PageHeader/PageHeader'
import { GitConfigSection } from './GitConfigSection'
import { PathRow } from './PathRow'
import styles from './SettingsPage.module.css'
import type { Theme } from './useTheme'

type Choice<T extends string> = { value: T; options: [T, string][]; onChange: (v: T) => void }

type Props<S extends string, P extends string> = {
  theme: Choice<Theme>
  submodules: Choice<S>
  pullAction: Choice<P>
  fetchInterval: Choice<string> | null
  keepRunning: { value: boolean; onChange: (on: boolean) => void } | null
  githubAvatars: { value: boolean; onChange: (on: boolean) => void } | null
  githubPrs: { value: boolean; onChange: (on: boolean) => void } | null
  version: string | null
  git: { path: string | null; version: string | null; onSave: (path: string) => Promise<string | null> } | null
  editor: { path: string | null; onSave: (path: string) => Promise<string | null> } | null
  fileManager: { path: string | null; onSave: (path: string) => Promise<string | null> } | null
  /** The open repository, for its own git settings. */
  repoId: number | null
  onClose: () => void
}

export function SettingsPage<S extends string, P extends string>({ theme, submodules, pullAction, fetchInterval, keepRunning, githubAvatars, githubPrs, version, git, editor, fileManager, repoId, onClose }: Props<S, P>) {
  const [commitWindow, setCommitWindow] = useState(commitInWindow)
  const [repoWindow, setRepoWindow] = useState(repoWindowOnDoubleClick)
  const [pullsWindow, setPullsWindow] = useState(pullsInWindow)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.page} role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <PageHeader title="Settings" className={styles.header} onClose={onClose} />
        <Section title="Appearance">
          <Row label="Theme">
            <ChoiceSelect choice={theme} />
          </Row>
          <Row label="Author pictures from GitHub (fetched once, then cached; off: initials, nothing leaves this machine)">
            <input
              type="checkbox"
              disabled={!githubAvatars}
              checked={githubAvatars?.value ?? false}
              onChange={(e) => githubAvatars?.onChange(e.target.checked)}
            />
          </Row>
        </Section>
        <Section title="Windows">
          <Row label="Always open the commit page in a new window">
            <input
              type="checkbox"
              checked={commitWindow}
              onChange={(e) => {
                setCommitWindow(e.target.checked)
                setCommitInWindow(e.target.checked)
              }}
            />
          </Row>
          <Row label="Double-click a repo to open it in a new window">
            <input
              type="checkbox"
              checked={repoWindow}
              onChange={(e) => {
                setRepoWindow(e.target.checked)
                setRepoWindowOnDoubleClick(e.target.checked)
              }}
            />
          </Row>
          <Row label="Open pull requests in a window (Ctrl+Shift+P, PR pills, Create pull request)">
            <input
              type="checkbox"
              checked={pullsWindow}
              onChange={(e) => {
                setPullsWindow(e.target.checked)
                setPullsInWindow(e.target.checked)
              }}
            />
          </Row>
        </Section>
        <Section title="GitHub">
          <Row label="Pull requests, through the host's own gh login (gh auth login on the host; no token is stored)">
            <input
              type="checkbox"
              disabled={!githubPrs}
              checked={githubPrs?.value ?? false}
              onChange={(e) => githubPrs?.onChange(e.target.checked)}
            />
          </Row>
        </Section>
        <Section title="Pull">
          <Row label="Default pull button action">
            <ChoiceSelect choice={pullAction} />
          </Row>
          <Row label="After a pull moves submodule pointers">
            <ChoiceSelect choice={submodules} />
          </Row>
          {fetchInterval && (
            <Row label="Auto fetch this project">
              <ChoiceSelect choice={fetchInterval} />
            </Row>
          )}
        </Section>
        {git && (
          <Section title="Git">
            <PathRow
              label="Git executable"
              placeholder="git (from PATH), or e.g. C:/Program Files/Git/cmd/git.exe"
              path={git.path}
              status={git.version ?? 'git not found'}
              onSave={git.onSave}
            />
            {editor && (
              <PathRow
                label="Editor for conflicts and files"
                placeholder="code (VS Code from PATH), or a path to an editor"
                path={editor.path}
                status={editor.path ? `Opens with ${editor.path}` : 'Opens with VS Code (code)'}
                onSave={editor.onSave}
              />
            )}
            {fileManager && (
              <PathRow
                label="File manager"
                placeholder="the system one, or e.g. C:/Program Files/FPilot/FPilot.exe"
                path={fileManager.path}
                status={fileManager.path ? `Opens with ${fileManager.path}` : 'Opens with the system file manager'}
                onSave={fileManager.onSave}
              />
            )}
          </Section>
        )}
        <Section title="Git configuration">
          <GitConfigSection repoId={repoId} />
        </Section>
        <Section title="Server">
          <Row label="Keep gitd running when every window is closed">
            <input
              type="checkbox"
              disabled={!keepRunning}
              checked={keepRunning?.value ?? false}
              onChange={(e) => keepRunning?.onChange(e.target.checked)}
            />
          </Row>
          <Row label="Version">{version ?? '?'}</Row>
        </Section>
        <p className={styles.note}>Appearance and pull are kept in this browser; the git executable in gitd's config; keep running lasts until gitd exits.</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.row}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function ChoiceSelect<T extends string>({ choice }: { choice: Choice<T> }) {
  return <Select value={choice.value} options={choice.options} onChange={choice.onChange} />
}
