import type { ReactNode } from 'react'
import { type MenuItem, SplitButton } from '../../ui/SplitButton/SplitButton'
import { PULL_ACTIONS, type PullAction, pullActionInfo } from './pullAction'

type Props = {
  defaultAction: PullAction
  disabled?: boolean
  suffix?: ReactNode
  onRun: (kind: PullAction) => void
  onSetDefault: (kind: PullAction) => void
}

export function PullButton({ defaultAction, disabled, suffix, onRun, onSetDefault }: Props) {
  const current = pullActionInfo(defaultAction)
  const menu: MenuItem[] = [
    ...PULL_ACTIONS.map((a) => ({ key: a.kind, label: `${a.icon} ${a.label}`, onSelect: () => onRun(a.kind) })),
    'separator',
    ...PULL_ACTIONS.map((a) => ({
      key: `default-${a.kind}`,
      label: `Default: ${a.label}`,
      checked: a.kind === defaultAction,
      onSelect: () => onSetDefault(a.kind),
    })),
  ]
  return (
    <SplitButton title={current.title} disabled={disabled} onClick={() => onRun(defaultAction)} menu={menu}>
      {current.icon}
      {suffix}
    </SplitButton>
  )
}
