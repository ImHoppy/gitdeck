import type { CommandResult } from '../features/repo-actions'
import { Toast } from '../ui/Toast/Toast'

/** A command's result; while it runs, the status bar says so. */
type Props = { last: CommandResult | null; onDismiss: () => void }

export function CommandStatus({ last, onDismiss }: Props) {
  if (!last) return null
  const o = last.outcome
  const text =
    o.kind === 'failed'
      ? `${last.title} failed: ${o.message}`
      : o.kind === 'skipped'
        ? `${last.title} skipped: ${o.reason}`
        : o.kind === 'conflict' || o.kind === 'autostashConflict'
          ? `${last.title} stopped on a conflict`
          : `${last.title}: done`
  const bad = o.kind === 'failed' || o.kind === 'conflict' || o.kind === 'autostashConflict' || o.kind === 'authFailed' || o.kind === 'rejected'
  return <Toast tone={bad ? 'bad' : 'ok'} title={text} onDismiss={onDismiss} autoHide={bad ? undefined : 4000} />
}
