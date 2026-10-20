import { useEffect, useMemo, useState } from 'react'
import { type Commands, useRepoCommands } from '../features/repo-actions'
import { useWorkspace } from '../features/workspace-tree'
import { relativeTime } from '../lib/relativeTime'
import { gitd } from '../protocol/client'
import { useDialogs } from '../ui/Dialog/useDialogs'
import { IconButton } from '../ui/IconButton/IconButton'
import { Spinner } from '../ui/Spinner/Spinner'
import { Toast } from '../ui/Toast/Toast'
import { VirtualList } from '../ui/VirtualList/VirtualList'
import styles from './Reflog.module.css'

type Entry = { sha: string; selector: string; time: number; action: string; subject: string }

/** Where HEAD has been: commits a reset or rebase left behind can be picked up again (`?reflog=`). */
export function ReflogWindow({ repoId, workspace: wsName }: { repoId: number; workspace: string }) {
  const { workspace, error, open } = useWorkspace()
  useEffect(() => {
    void open(wsName)
  }, [open, wsName])
  const ready = workspace?.repos.some((r) => r.id === repoId) ?? false
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const commands = useRepoCommands(repoId)
  const dialogs = useDialogs()
  const cmd: Commands = useMemo(() => ({ run: commands.run, prompt: dialogs.prompt, confirm: dialogs.confirm }), [commands.run, dialogs.prompt, dialogs.confirm])

  useEffect(() => {
    if (!ready) return
    document.title = 'Reflog'
    gitd.call<Entry[]>('reflog.list', { id: repoId }).then(setEntries, (e: Error) => setFailed(e.message))
  }, [ready, repoId, commands.last])

  if (error ?? failed) return <div className={styles.empty}>{error ?? failed}</div>
  if (!entries) return <div className={styles.empty}><Spinner /></div>
  return (
    <div className={styles.window}>
      <p className={styles.hint}>Every place HEAD pointed to, newest first. A commit lost to a reset or rebase is still here: branch from it to get it back.</p>
      <div className={styles.list}>
        <VirtualList
          count={entries.length}
          rowHeight={30}
          renderRow={(i) => {
            const e = entries[i]
            return (
              <div className={styles.row}>
                <code className={styles.sha}>{e.sha.slice(0, 8)}</code>
                <span className={styles.selector}>{e.selector}</span>
                <span className={styles.text} title={`${e.action}\n${e.subject}`}>
                  <span className={styles.action}>{e.action}</span> {e.subject}
                </span>
                <span className={styles.when}>{relativeTime(e.time)}</span>
                <span className={styles.buttons}>
                  <IconButton
                    title="Create a branch at this commit"
                    onClick={async () => {
                      const name = await cmd.prompt('Create branch', `New branch at ${e.sha.slice(0, 10)}`)
                      if (name) await cmd.run(`create ${name}`, { kind: 'createBranch', name, at: e.sha, checkout: false })
                    }}
                  >
                    Branch…
                  </IconButton>
                  <IconButton
                    title="Move the current branch here, dropping uncommitted changes"
                    onClick={async () => {
                      if (await cmd.confirm('Hard reset?', `The current branch moves to ${e.sha.slice(0, 10)} and uncommitted changes are lost.`, 'Reset')) {
                        await cmd.run('reset --hard', { kind: 'reset', sha: e.sha, mode: 'hard' })
                      }
                    }}
                  >
                    Reset here…
                  </IconButton>
                </span>
              </div>
            )
          }}
        />
      </div>
      {commands.last && commands.last.outcome.kind === 'failed' && <Toast tone="bad" title={commands.last.outcome.message} onDismiss={commands.clear} />}
      {dialogs.element}
    </div>
  )
}
