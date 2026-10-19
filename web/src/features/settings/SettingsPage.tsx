import type { ReactNode } from 'react'
import { IconButton } from '../../ui/IconButton/IconButton'
import styles from './SettingsPage.module.css'
import type { Theme } from './useTheme'

type Choice<T extends string> = { value: T; options: [T, string][]; onChange: (v: T) => void }

type Props<S extends string, P extends string> = {
  theme: Choice<Theme>
  submodules: Choice<S>
  pullAction: Choice<P>
  keepRunning: { value: boolean; onChange: (on: boolean) => void } | null
  version: string | null
  onClose: () => void
}

export function SettingsPage<S extends string, P extends string>({ theme, submodules, pullAction, keepRunning, version, onClose }: Props<S, P>) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.page} role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <strong>Settings</strong>
          <IconButton title="Close" onClick={onClose}>
            ✕
          </IconButton>
        </header>
        <Section title="Appearance">
          <Row label="Theme">
            <Select choice={theme} />
          </Row>
        </Section>
        <Section title="Pull">
          <Row label="Default pull button action">
            <Select choice={pullAction} />
          </Row>
          <Row label="After a pull moves submodule pointers">
            <Select choice={submodules} />
          </Row>
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
        <p className={styles.note}>These settings are kept in this browser; keep running lasts until gitd exits.</p>
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

function Select<T extends string>({ choice }: { choice: Choice<T> }) {
  return (
    <select value={choice.value} onChange={(e) => choice.onChange(e.target.value as T)}>
      {choice.options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  )
}
