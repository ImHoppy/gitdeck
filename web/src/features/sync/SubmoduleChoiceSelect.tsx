import type { SubmoduleChoice } from './submoduleChoice'

type Props = { value: SubmoduleChoice; onChange: (c: SubmoduleChoice) => void }

export function SubmoduleChoiceSelect({ value, onChange }: Props) {
  return (
    <select
      title="After a pull moves submodule pointers: update submodules?"
      value={value}
      onChange={(e) => onChange(e.target.value as SubmoduleChoice)}
    >
      <option value="ask">submodules: ask</option>
      <option value="always">submodules: always update</option>
      <option value="never">submodules: never update</option>
    </select>
  )
}
