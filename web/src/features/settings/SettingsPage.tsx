import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { commitInWindow, setCommitInWindow } from '../../lib/commitWindow'
import { repoWindowOnDoubleClick, setRepoWindowOnDoubleClick } from '../../lib/repoWindow'
import { pullsInWindow, setPullsInWindow } from '../../lib/pullsWindow'
import { PageHeader } from '../../ui/PageHeader/PageHeader'
import { GitConfigSection } from './GitConfigSection'
import type { GitNotice } from './gitNotice'
import { HostFlags, type Host } from './HostFlags'
import { Button } from '../../ui/Button/Button'
import { type Choice, ChoiceSelect, Row, Section } from './SettingRows'
import { SettingsNav } from './SettingsNav'
import { ToolPaths } from './ToolPaths'
import { UpdateRow } from './UpdateRow'
import { useSectionSpy } from './useSectionSpy'
import styles from './SettingsPage.module.css'
import type { Theme } from './useTheme'

const SECTION = {
  appearance: { id: 'settings-appearance', title: 'Appearance' },
  windows: { id: 'settings-windows', title: 'Windows' },
  github: { id: 'settings-github', title: 'GitHub' },
  pull: { id: 'settings-pull', title: 'Pull' },
  git: { id: 'settings-git', title: 'Programs' },
  gitconfig: { id: 'settings-gitconfig', title: 'Git configuration' },
  server: { id: 'settings-server', title: 'Server' },
}

type Props<S extends string, P extends string> = {
  theme: Choice<Theme>
  submodules: Choice<S>
  pullAction: Choice<P>
  fetchInterval: Choice<string> | null
  keepRunning: { value: boolean; onChange: (on: boolean) => void } | null
  githubAvatars: { value: boolean; onChange: (on: boolean) => void } | null
  githubPrs: { value: boolean; onChange: (on: boolean) => void } | null
  version: string | null
  git: { path: string | null; version: string | null; notice: GitNotice | null; onSave: (path: string) => Promise<string | null> } | null
  editor: { path: string | null; onSave: (path: string) => Promise<string | null> } | null
  fileManager: { path: string | null; detected: string | null; onSave: (path: string) => Promise<string | null> } | null
  host: Host | null
  update: ComponentProps<typeof UpdateRow> | null
  onSetup: () => void
  /** The open repository, for its own git settings. */
  repoId: number | null
  onClose: () => void
}

export function SettingsPage<S extends string, P extends string>({ theme, submodules, pullAction, fetchInterval, keepRunning, githubAvatars, githubPrs, version, git, editor, fileManager, host, update, onSetup, repoId, onClose }: Props<S, P>) {
  const [commitWindow, setCommitWindow] = useState(commitInWindow)
  const [repoWindow, setRepoWindow] = useState(repoWindowOnDoubleClick)
  const [pullsWindow, setPullsWindow] = useState(pullsInWindow)
  const content = useRef<HTMLDivElement>(null)
  const sections = Object.values(SECTION).filter((s) => git || s !== SECTION.git)
  const spy = useSectionSpy(content, sections.map((s) => s.id))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.page} role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <PageHeader title="Settings" className={styles.header} onClose={onClose} />
        <div className={styles.body}>
          <SettingsNav sections={sections} active={spy.active} onPick={spy.go} />
          <div className={styles.content} ref={content}>
            <Section {...SECTION.appearance}>
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
            <Section {...SECTION.windows}>
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
            <Section {...SECTION.github}>
              <Row label="Pull requests, through the host's own gh login (gh auth login on the host; no token is stored)">
                <input
                  type="checkbox"
                  disabled={!githubPrs}
                  checked={githubPrs?.value ?? false}
                  onChange={(e) => githubPrs?.onChange(e.target.checked)}
                />
              </Row>
            </Section>
            <Section {...SECTION.pull}>
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
              <Section {...SECTION.git}>
                <ToolPaths git={git} editor={editor} fileManager={fileManager} />
              </Section>
            )}
            <Section {...SECTION.gitconfig}>
              <GitConfigSection repoId={repoId} />
            </Section>
            <Section {...SECTION.server}>
              <Row label="Keep gitd running when every window is closed">
                <input
                  type="checkbox"
                  disabled={!keepRunning}
                  checked={keepRunning?.value ?? false}
                  onChange={(e) => keepRunning?.onChange(e.target.checked)}
                />
              </Row>
              {host && <HostFlags host={host} />}
              {update ? <UpdateRow {...update} /> : <Row label="Version">{version ?? '?'}</Row>}
              <div className={styles.row}>
                <span>First-run setup</span>
                <Button title="Show the first-run setup again" onClick={onSetup}>Run again</Button>
              </div>
            </Section>
            <p className={styles.note}>Appearance and pull are kept in this browser; the git executable in gitd's config; keep running lasts until gitd exits.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
