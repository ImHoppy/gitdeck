const COLORS = ['#e5484d', '#3e63dd', '#30a46c', '#f76b15', '#8e4ec6', '#12a594', '#d6409f', '#978365', '#0090ff', '#ab4aba']

export function initials(name: string): string {
  const words = name.replace(/[[\](){}<>]/g, ' ').trim().split(/[\s._-]+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const second = words.length > 1 ? words[words.length - 1][0] : (words[0][1] ?? '')
  return (first + second).toUpperCase()
}

export function avatarColor(key: string): string {
  let h = 0
  for (const c of key.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

export function isBot(name: string, email: string): boolean {
  return /\[bot\]$/i.test(name) || /\[bot\]@users\.noreply\.github\.com$/i.test(email)
}
