import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'

export type ServerInfo = { keepRunning: boolean; version: string }

export function useServerInfo() {
  const [info, setInfo] = useState<ServerInfo | null>(null)

  useEffect(() => {
    gitd.call<ServerInfo>('server.info').then(setInfo, () => setInfo(null))
  }, [])

  const setKeepRunning = useCallback((on: boolean) => {
    gitd.call<ServerInfo>('server.keepRunning', { on }).then(setInfo, () => {})
  }, [])

  return { info, setKeepRunning }
}
