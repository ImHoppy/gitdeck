import type { JobUpdate } from '../../protocol/types'

export function mergeJob(old: JobUpdate | undefined, update: JobUpdate): JobUpdate {
  const lines = old ? [...old.lines.slice(0, update.from), ...update.lines] : update.lines
  return { ...update, from: 0, lines }
}

export function progressOf(job: JobUpdate): number | null {
  const m = /(\d{1,3})%/.exec(job.current)
  return m ? Number(m[1]) : null
}

export function statusLine(job: JobUpdate): string {
  return (job.current || job.lines[job.lines.length - 1] || '').trim()
}

export function isErrorLine(line: string): boolean {
  return /^(fatal|error|remote: error|ERROR)\b/.test(line)
}

export function firstError(job: JobUpdate): string | null {
  return job.lines.find(isErrorLine) ?? null
}
