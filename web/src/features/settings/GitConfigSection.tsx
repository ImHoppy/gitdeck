import { useState } from 'react'
import { Select } from '../../ui/Select/Select'
import styles from './SettingsPage.module.css'
import { type ConfigScope, useGitConfig } from './useGitConfig'

const SCOPES = [
  ['global', 'All repositories (global)'],
  ['local', 'This repository'],
] as const

const TEXT: [string, string, string][] = [
  ['user.name', 'Name on your commits', 'Ann Lee'],
  ['user.email', 'Email on your commits', 'ann@example.com'],
  ['init.defaultBranch', 'Branch of new repositories', 'main'],
  ['core.editor', 'Editor git opens itself', 'code --wait'],
  ['diff.tool', 'Diff tool', 'vscode'],
  ['merge.tool', 'Merge tool', 'vscode'],
]

const YES_NO = [
  ['', 'git default'],
  ['true', 'yes'],
  ['false', 'no'],
] as const

const FLAGS: [string, string][] = [
  ['push.autoSetupRemote', 'Push new branches without --set-upstream'],
  ['fetch.prune', 'Remove deleted remote branches on fetch'],
  ['commit.gpgsign', 'Sign commits'],
]

const CRLF = [
  ['', 'git default'],
  ['true', 'true: CRLF in files, LF in commits'],
  ['input', 'input: LF in commits, files as they are'],
  ['false', 'false: never convert'],
] as const

/** `git config` of one scope; the local scope overrides the global one for this repository. */
export function GitConfigSection({ repoId }: { repoId: number | null }) {
  const [scope, setScope] = useState<ConfigScope>('global')
  const cfg = useGitConfig(repoId, scope)
  const v = cfg.values ?? {}

  return (
    <>
      <div className={styles.row}>
        <span>Settings of</span>
        <Select value={scope} options={repoId === null ? SCOPES.slice(0, 1) : SCOPES} onChange={setScope} />
      </div>
      {scope === 'local' && <p className={styles.hint}>Empty means the global value applies.</p>}
      {TEXT.map(([key, label, placeholder]) => (
        <TextRow key={`${scope}:${key}:${v[key] ?? ''}`} label={label} placeholder={placeholder} value={v[key] ?? ''} onSave={(value) => void cfg.set(key, value)} />
      ))}
      <div className={styles.row}>
        <span>Line endings (core.autocrlf)</span>
        <Select value={(v['core.autocrlf'] ?? '') as (typeof CRLF)[number][0]} options={CRLF} onChange={(value) => void cfg.set('core.autocrlf', value)} />
      </div>
      {FLAGS.map(([key, label]) => (
        <div key={key} className={styles.row}>
          <span>{label}</span>
          <Select value={(v[key] ?? '') as (typeof YES_NO)[number][0]} options={YES_NO} onChange={(value) => void cfg.set(key, value)} />
        </div>
      ))}
      {cfg.error && <p className={styles.error}>{cfg.error}</p>}
    </>
  )
}

function TextRow({ label, placeholder, value, onSave }: { label: string; placeholder: string; value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const save = () => draft.trim() !== value && onSave(draft.trim())
  return (
    <label className={styles.row}>
      <span>{label}</span>
      <input
        className={styles.configInput}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
    </label>
  )
}
