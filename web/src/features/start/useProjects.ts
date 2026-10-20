import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'

export type Project = { name: string; roots: string[] }

const RECENT = 'gitdeck.recent'

function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT) ?? '[]')
    return Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string') : []
  } catch {
    return []
  }
}

/** Remembers `name` as the most recently opened project. */
export function touchRecent(name: string) {
  try {
    localStorage.setItem(RECENT, JSON.stringify([name, ...loadRecent().filter((n) => n !== name)].slice(0, 50)))
  } catch {
    // storage blocked: the order lasts for this page only
  }
}

/** Projects (workspaces) for the start page, most recently opened first, and the ways to add one. */
export function useProjects() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    gitd.call<Project[]>('project.recent').then(
      (all) => {
        const order = loadRecent()
        const rank = (p: Project) => (order.includes(p.name) ? order.indexOf(p.name) : order.length)
        setProjects([...all].sort((a, b) => rank(a) - rank(b)))
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  const run = useCallback(async (label: string, method: string, params: object): Promise<string | null> => {
    setBusy(label)
    setError(null)
    try {
      return await gitd.call<string>(method, params)
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setBusy(null)
    }
  }, [])

  return {
    projects,
    error,
    busy,
    openFolder: (path: string) => run('Opening…', 'project.open', { path }),
    init: (path: string) => run('Creating the repository…', 'project.init', { path }),
    clone: (url: string, path: string) => run('Cloning…', 'project.clone', { url, path }),
    cloneDirName: (url: string) => gitd.call<string>('project.cloneDirName', { url }),
  }
}
