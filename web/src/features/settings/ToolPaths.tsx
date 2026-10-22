import { fileManagerStatus } from './fileManagerStatus'
import { PathRow } from './PathRow'

type Save = (path: string) => Promise<string | null>

type Props = {
  git: { path: string | null; version: string | null; onSave: Save }
  editor: { path: string | null; onSave: Save } | null
  fileManager: { path: string | null; detected: string | null; onSave: Save } | null
}

/** The programs gitd starts: git, the editor and the file manager. */
export function ToolPaths({ git, editor, fileManager }: Props) {
  return (
    <>
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
          status={editor.path ? `Opens with ${editor.path}` : 'Current default: VS Code (code)'}
          onSave={editor.onSave}
        />
      )}
      {fileManager && (
        <PathRow
          label="File manager"
          placeholder="the system one, or e.g. C:/Program Files/FPilot/FPilot.exe"
          path={fileManager.path}
          status={fileManagerStatus(fileManager.path, fileManager.detected)}
          onSave={fileManager.onSave}
        />
      )}
    </>
  )
}
