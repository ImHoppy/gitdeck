import { FlagRow } from './FlagRow'

type Flag = (on: boolean) => Promise<string | null>

export type Host = {
  /** null where there is no Explorer menu. */
  explorerMenu: boolean | null
  autostart: boolean
  autoUpdate: boolean
  setExplorerMenu: Flag
  setAutostart: Flag
  setAutoUpdate: Flag
}

/** How gitdeck sits on the host: the folder menu, start at login, updates. */
export function HostFlags({ host }: { host: Host }) {
  return (
    <>
      {host.explorerMenu !== null && (
        <FlagRow label={'"Open in gitdeck" on folders in Explorer'} checked={host.explorerMenu} onChange={host.setExplorerMenu} />
      )}
      <FlagRow label="Start gitd at login, in the background" checked={host.autostart} onChange={host.setAutostart} />
      <FlagRow label="Update gitdeck automatically" checked={host.autoUpdate} onChange={host.setAutoUpdate} />
    </>
  )
}
