import { Avatar } from '../../ui/Avatar/Avatar'

/** A GitHub login's avatar: its noreply address is what the opt-in avatar fetch knows. */
export function Who({ login, size = 20 }: { login: string; size?: number }) {
  return <Avatar name={login} email={`${login}@users.noreply.github.com`} size={size} />
}
