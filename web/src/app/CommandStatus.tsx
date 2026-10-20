import type { CommandResult } from '../features/repo-actions'
import { Toast } from '../ui/Toast/Toast'

type Props = { busy: boolean; last: CommandResult | null; onDismiss: () => void }

export function CommandStatus({ busy, last, onDismiss }: Props) {
  if (busy) return <Toast tone="busy" title="Running…" />
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
