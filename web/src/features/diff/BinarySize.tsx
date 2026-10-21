import type { BinarySizes } from '../../protocol/types'
import { formatBytes } from '../../lib/formatBytes'
import styles from './Diff.module.css'

function describe({ old, new: now }: BinarySizes): string {
  if (old === null && now === null) return 'Binary file'
  if (old === null) return `Binary file added: ${formatBytes(now!)}`
  if (now === null) return `Binary file deleted: ${formatBytes(old)}`
  const delta = now - old
  if (delta === 0) return `Binary file: ${formatBytes(now)} (same size)`
  const sign = delta > 0 ? '+' : '−'
  return `Binary file: ${formatBytes(old)} → ${formatBytes(now)} (${sign}${formatBytes(delta)})`
}

export function BinarySize({ sizes }: { sizes: BinarySizes }) {
  return <div className={styles.binarySize}>{describe(sizes)}</div>
}
