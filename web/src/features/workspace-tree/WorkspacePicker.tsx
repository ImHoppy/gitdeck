import styles from './WorkspaceTree.module.css'

type Props = { names: string[]; current: string; onOpen: (name: string) => void; onAdd: () => void }

export function WorkspacePicker({ names, current, onOpen, onAdd }: Props) {
  return (
    <span className={styles.picker}>
      <select value={current} title="Workspace" onChange={(e) => onOpen(e.target.value)}>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button title="Add a repository folder to a workspace" onClick={onAdd}>
        +
      </button>
    </span>
  )
}
