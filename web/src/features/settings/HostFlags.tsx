import { FlagRow } from './FlagRow'
import { ChoiceSelect, Row } from './SettingRows'

type Flag = (on: boolean) => Promise<string | null>

export type UpdateMode = 'off' | 'notify' | 'auto'

const UPDATE_MODES: [UpdateMode, string][] = [
  ['off', 'Never check'],
  ['notify', 'Tell me'],
  ['auto', 'Install automatically'],
]

export type Host = {
  /** null where there is no Explorer menu. */
  explorerMenu: boolean | null
  autostart: boolean
  updates: UpdateMode
  setExplorerMenu: Flag
  setAutostart: Flag
  setUpdates: (mode: UpdateMode) => void
}

/** How gitdeck sits on the host: the folder menu, start at login, updates. */
export function HostFlags({ host }: { host: Host }) {
  return (
    <>
      {host.explorerMenu !== null && (
        <FlagRow label={'"Open in gitdeck" on folders in Explorer'} checked={host.explorerMenu} onChange={host.setExplorerMenu} />
      )}
      <FlagRow label="Start gitd at login, in the background" checked={host.autostart} onChange={host.setAutostart} />
      <Row label="New gitdeck versions (from GitHub releases)">
        <ChoiceSelect choice={{ value: host.updates, options: UPDATE_MODES, onChange: host.setUpdates }} />
      </Row>
    </>
  )
}
