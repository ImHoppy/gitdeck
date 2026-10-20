import { useCallback, useState } from 'react'
import { pickFolder } from '../../lib/pickFolder'
import { gitd } from '../../protocol/client'
import type { SyncOutcome } from '../../protocol/types'

export type ToolResult = { ok: boolean; text: string }

async function pickFiles(title: string, extension?: string): Promise<string[] | null> {
  return gitd.call<string[] | null>('fs.pickFile', { title, extension }).catch(() => null)
}

async function pickSaveAs(title: string, name: string, extension: string): Promise<string | null> {
  const r = await gitd.call<string[] | null>('fs.pickFile', { title, saveAs: name, extension }).catch(() => null)
  return r?.[0] ?? null
}

/** Repo commands that aren't a plain git action: bisect, patches, archives, ignore, external tools. */
export function useRepoTools(repoId: number) {
  const [result, setResult] = useState<ToolResult | null>(null)

  const run = useCallback(async (job: () => Promise<string | null>) => {
    try {
      const text = await job()
      if (text) setResult({ ok: true, text })
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message })
    }
  }, [])

  const id = repoId
  return {
    result,
    clear: useCallback(() => setResult(null), []),
    bisect: (mark: 'good' | 'bad' | 'skip', sha: string) => run(() => gitd.call<string>('bisect', { id, mark, sha })),
    stopBisect: () => run(() => gitd.call<string>('bisect', { id })),
    savePatches: (shas: string[]) =>
      run(async () => {
        const dir = await pickFolder('', 'Save the patches in')
        if (!dir) return null
        const files = await gitd.call<string[]>('patch.save', { id, shas, dir })
        return `Saved ${files.length} patch${files.length === 1 ? '' : 'es'} in ${dir}`
      }),
    applyPatches: () =>
      run(async () => {
        const files = await pickFiles('Patches to apply', 'patch')
        if (!files?.length) return null
        const o = await gitd.call<SyncOutcome>('patch.apply', { id, files })
        if (o.kind === 'failed') throw new Error(o.message)
        return o.kind === 'conflict' ? 'A patch did not apply cleanly: resolve, then continue' : `Applied ${files.length} patch${files.length === 1 ? '' : 'es'}`
      }),
    archive: (rev: string, name: string) =>
      run(async () => {
        const file = await pickSaveAs('Export as zip', `${name}.zip`, 'zip')
        if (!file) return null
        await gitd.call('repo.archive', { id, rev, file })
        return `Exported ${rev.slice(0, 8)} to ${file}`
      }),
    ignore: (pattern: string, exclude = false) =>
      run(async () => (await gitd.call('changes.ignore', { id, pattern, exclude }), `Added ${pattern} to ${exclude ? '.git/info/exclude' : '.gitignore'}`)),
    reveal: (path?: string) => run(async () => (await gitd.call('repo.reveal', { id, with: 'explorer', path }), null)),
    openInEditor: (path?: string, line?: number) => run(async () => (await gitd.call('editor.open', { id, path, line }), null)),
    diffTool: (path: string, opts: { base?: string | null; rev?: string; staged?: boolean; editor?: boolean }) => run(async () => (await gitd.call('tool.diff', { id, path, ...opts }), null)),
    mergeTool: (path: string) => run(async () => (await gitd.call('tool.merge', { id, path }), null)),
  }
}
