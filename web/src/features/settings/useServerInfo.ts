import { useCallback, useEffect, useMemo, useState } from 'react'
import { setAvatarsEnabled } from '../../lib/avatarSource'
import { gitd } from '../../protocol/client'
import type { Host } from './HostFlags'

export type ServerInfo = {
  keepRunning: boolean
  version: string
  git: string | null
  gitVersion: string | null
  githubAvatars: boolean
  githubPrs: boolean
  editor: string | null
  fileManager: string | null
  fileManagerDetected: string | null
  fetchInterval: number | null
  setupDone: boolean
  autoUpdate: boolean
  /** null where there is no Explorer menu (Linux, macOS). */
  explorerMenu: boolean | null
  autostart: boolean
}

export function useServerInfo() {
  const [info, setInfo] = useState<ServerInfo | null>(null)

  const reload = useCallback(() => {
    gitd.call<ServerInfo>('server.info').then(setInfo, () => setInfo(null))
  }, [])

  useEffect(reload, [reload])

  useEffect(() => setAvatarsEnabled(info?.githubAvatars ?? false), [info])

  const setKeepRunning = useCallback((on: boolean) => {
    gitd.call<ServerInfo>('server.keepRunning', { on }).then(setInfo, () => {})
  }, [])

  const setGit = useCallback(async (path: string): Promise<string | null> => {
    try {
      setInfo(await gitd.call<ServerInfo>('server.setGit', { path }))
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [])

  const setGithubAvatars = useCallback((on: boolean) => {
    gitd.call<ServerInfo>('server.setAvatars', { on }).then(setInfo, () => {})
  }, [])

  const setGithubPrs = useCallback((on: boolean) => {
    gitd.call<ServerInfo>('server.setGithubPrs', { on }).then(setInfo, () => {})
  }, [])

  const setEditor = useCallback(async (path: string): Promise<string | null> => {
    try {
      setInfo(await gitd.call<ServerInfo>('server.setEditor', { path }))
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [])

  const setFileManager = useCallback(async (path: string): Promise<string | null> => {
    try {
      setInfo(await gitd.call<ServerInfo>('server.setFileManager', { path }))
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [])

  const setFetchInterval = useCallback((minutes: number) => {
    gitd.call<ServerInfo>('server.setFetchInterval', { minutes }).then(setInfo, () => {})
  }, [])

  /** Resolves to an error message, or null once applied. */
  const setFlag = useCallback(async (method: string, on: boolean): Promise<string | null> => {
    try {
      setInfo(await gitd.call<ServerInfo>(method, { on }))
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [])
  const setExplorerMenu = useCallback((on: boolean) => setFlag('server.setExplorerMenu', on), [setFlag])
  const setAutostart = useCallback((on: boolean) => setFlag('server.setAutostart', on), [setFlag])
  const setAutoUpdate = useCallback((on: boolean) => setFlag('server.setAutoUpdate', on), [setFlag])

  const host = useMemo<Host | null>(
    () =>
      info && {
        explorerMenu: info.explorerMenu,
        autostart: info.autostart,
        autoUpdate: info.autoUpdate,
        setExplorerMenu,
        setAutostart,
        setAutoUpdate,
      },
    [info, setExplorerMenu, setAutostart, setAutoUpdate],
  )

  const finishSetup = useCallback(() => {
    gitd.call<ServerInfo>('server.finishSetup').then(setInfo, () => {})
  }, [])

  return {
    info,
    reload,
    setFetchInterval,
    setKeepRunning,
    setGit,
    setGithubAvatars,
    setGithubPrs,
    setEditor,
    setFileManager,
    host,
    finishSetup,
  }
}
