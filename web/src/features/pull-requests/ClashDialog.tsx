import { Dialog } from '../../ui/Dialog/Dialog'
import { Button } from '../../ui/Button/Button'

type Props = { branch: string; separate: string; onPick: (choice: 'useExisting' | 'separate' | null) => void }

/** A local branch already has the PR's name but follows something else. */
export function ClashDialog({ branch, separate, onPick }: Props) {
  return (
    <Dialog
      title="Branch name taken"
      actions={
        <>
          <Button title="Do nothing" onClick={() => onPick(null)}>Cancel</Button>
          <Button title={`Switch to ${branch} as it is`} onClick={() => onPick('useExisting')}>Use {branch}</Button>
          <Button title={`A new branch ${separate} from the PR head`} onClick={() => onPick('separate')}>Create {separate}</Button>
        </>
      }
    >
      A local branch <strong>{branch}</strong> exists but doesn't follow this PR's branch. Switch to it anyway, or create <strong>{separate}</strong> for the PR?
    </Dialog>
  )
}
