import { Icon } from '../../ui/Icon/Icon'
import { Select } from '../../ui/Select/Select'
import type { ReactNode } from 'react'
import { IconButton } from '../../ui/IconButton/IconButton'
import { GitConfigSection } from './GitConfigSection'
import { PathRow } from './PathRow'
import styles from './SettingsPage.module.css'
import type { Theme } from './useTheme'

type Choice<T extends string> = { value: T; options: [T, string][]; onChange: (v: T) => void }

type Props<S extends string, P extends string> = {
  theme: Choice<Theme>
  submodules: Choice<S>
  pullAction: Choice<P>
  keepRunning: { value: boolean; onChange: (on: boolean) => void } | null
  githubAvatars: { value: boolean; onChange: (on: boolean) => void } | null
  version: string | null
  git: { path: string | null; version: string | null; onSave: (path: string) => Promise<string | null> } | null
  editor: { path: string | null; onSave: (path: string) => Promise<string | null> } | null
  /** The open repository, for its own git settings. */
  repoId: number | null
  onClose: () => void
}

export function SettingsPage<S extends string, P extends string>({ theme, submodules, pullAction, keepRunning, githubAvatars, version, git, editor, repoId, onClose }: Props<S, P>) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.page} role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <strong>Settings</strong>
          <IconButton title="Close" onClick={onClose}>
            <Icon name="close" size={12} />
          </IconButton>
        </header>
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
        <Section title="Pull">
          <Row label="Default pull button action">
            <ChoiceSelect choice={pullAction} />
          </Row>
          <Row label="After a pull moves submodule pointers">
            <ChoiceSelect choice={submodules} />
          </Row>
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
