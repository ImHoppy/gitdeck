import { Icon } from '../../ui/Icon/Icon'
import { Select } from '../../ui/Select/Select'
import styles from './WorkspaceTree.module.css'

type Props = { names: string[]; current: string; onOpen: (name: string) => void; onAdd: () => void }

export function WorkspacePicker({ names, current, onOpen, onAdd }: Props) {
  return (
    <span className={styles.picker}>
      <Select value={current} title="Workspace" options={names.map((n) => [n, n] as const)} onChange={onOpen} />
      <button title="Add a repository folder to a workspace" onClick={onAdd}>
        <Icon name="add" size={12} />
      </button>
    </span>
  )
}
