import { Button } from '../Button/Button'
import type { Browse } from './useDialogs'

type Props = { browse: Browse; current: string; onPick: (path: string) => void }

export function BrowseButton({ browse, current, onPick }: Props) {
  return (
    <Button
      title="Choose a folder"
      onClick={() => {
        void browse(current).then((path) => path && onPick(path))
      }}
    >
      Browse…
    </Button>
  )
}
