import { IconButton } from '../IconButton/IconButton'
import type { Browse } from './useDialogs'

type Props = { browse: Browse; current: string; onPick: (path: string) => void }

export function BrowseButton({ browse, current, onPick }: Props) {
  return (
    <IconButton
      title="Choose a folder"
      onClick={() => {
        void browse(current).then((path) => path && onPick(path))
      }}
    >
      Browse…
    </IconButton>
  )
}
