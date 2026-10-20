import { useState } from 'react'
import { pickFolder } from '../../lib/pickFolder'
import { useDialogs } from '../../ui/Dialog/useDialogs'
import { Icon, type IconName } from '../../ui/Icon/Icon'
import { Spinner } from '../../ui/Spinner/Spinner'
import { Toast } from '../../ui/Toast/Toast'
import { CloneDialog } from './CloneDialog'
import styles from './StartPage.module.css'
import { useProjects } from './useProjects'

/** Like the Git Extensions dashboard: start actions on the left, recent repositories on the right. */
export function StartPage({ onOpen: openProject }: { onOpen: (name: string) => Promise<void> }) {
  const p = useProjects()
  const dialogs = useDialogs()
  const [cloning, setCloning] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(null)
  // opening a big project takes a while (status of every repo): show which one is on its way
  const [opening, setOpening] = useState<string | null>(null)
  const onOpen = async (name: string) => {
    setOpening(name)
    try {
      await openProject(name)
    } finally {
      setOpening(null)
    }
  }

  const then = (name: string | null) => {
    if (name) void onOpen(name)
  }
  const openRepo = async () => {
    const path = await dialogs.prompt('Open repository', 'Folder of a git repository', '', pickFolder)
    if (path?.trim()) then(await p.openFolder(path.trim()))
  }
  const createRepo = async () => {
    const path = await dialogs.prompt('Create new repository', 'Folder for the new repository (created when missing)', '', pickFolder)
    if (path?.trim()) then(await p.init(path.trim()))
  }

  return (
    <div className={styles.page}>
      <aside className={styles.side}>
        <div className={styles.brand}>
          <img src="/favicon.svg" alt="" width={28} height={28} />
          gitdeck
        </div>
        <h2 className={styles.heading}>Start</h2>
        <Action icon="add" label="Create new repository" onClick={() => void createRepo()} />
        <Action icon="folder" label="Open repository" onClick={() => void openRepo()} />
        <Action icon="fetch" label="Clone repository" onClick={() => setCloning(true)} />
      </aside>
      <main className={styles.main}>
        <h2 className={styles.heading}>Recent repositories</h2>
        {!p.projects ? (
          <Spinner />
        ) : p.projects.length === 0 ? (
          <p className={styles.empty}>Nothing yet: open, create or clone a repository.</p>
        ) : (
          <ul className={styles.recent}>
            {p.projects.map((project) => (
              <li key={project.name}>
                <button
                  className={`${styles.project} ${opening === project.name ? styles.opening : ''}`}
                  disabled={opening !== null}
                  onClick={() => void onOpen(project.name)}
                >
                  {opening === project.name ? <Spinner /> : <Icon name="repo" size={16} />}
                  <span className={styles.projectText}>
                    <span className={styles.name}>{project.name}</span>
                    <span className={styles.roots}>{opening === project.name ? 'Opening… reading every repository' : project.roots.join(' · ') || 'no folder'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      {cloning && (
        <CloneDialog
          dirName={p.cloneDirName}
          onCancel={() => setCloning(false)}
          onClone={(url, path) => {
            setCloning(false)
            void p.clone(url, path).then(then)
          }}
        />
      )}
      {p.busy && <Toast tone="busy" title={p.busy} />}
      {p.error && p.error !== dismissed && <Toast tone="bad" title={p.error} onDismiss={() => setDismissed(p.error)} />}
      {dialogs.element}
    </div>
  )
}

function Action({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className={styles.action} onClick={onClick}>
      <Icon name={icon} size={16} />
      {label}
    </button>
  )
}
