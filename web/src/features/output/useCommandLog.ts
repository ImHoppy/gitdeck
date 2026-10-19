import { useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { CommandRecord } from '../../protocol/types'

const KEEP = 500

export function useCommandLog() {
  const [records, setRecords] = useState<CommandRecord[]>([])

  useEffect(() => {
    gitd.call<CommandRecord[]>('commands.recent').then(setRecords, () => {})
    return gitd.on<CommandRecord>('command-log', (r) => setRecords((old) => [...old.slice(-(KEEP - 1)), r]))
  }, [])

  return records
}
