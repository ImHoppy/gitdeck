import { saveSetting } from './storedSetting'

const key = (project: string) => `gitdeck.lastRepo.${project}`

/** The repo last opened in `project`, by path: ids are handed out again on every discovery. */
export function loadLastRepo(project: string): string | null {
  try {
    return localStorage.getItem(key(project))
  } catch {
    return null
  }
}

export function saveLastRepo(project: string, path: string) {
  saveSetting(key(project), path)
}
