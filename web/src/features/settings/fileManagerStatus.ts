export function fileManagerStatus(path: string | null, detected: string | null) {
  if (path) return `Opens with ${path}`
  return detected ? `Current default: ${detected}` : 'Opens with the system file manager'
}
