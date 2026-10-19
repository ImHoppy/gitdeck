import type { GraphRow } from '../../protocol/types'
import { laneColor } from './laneColor'

export const LANE_WIDTH = 14
const NODE = 10

type Props = { row: GraphRow; height: number; width: number; square: boolean; head: boolean }

export function GraphCell({ row, height, width, square, head }: Props) {
  const x = (lane: number) => lane * LANE_WIDTH + LANE_WIDTH / 2
  const mid = height / 2
  const nx = x(row.lane)
  return (
    <svg width={width} height={height} style={{ flex: 'none', display: 'block' }}>
      {row.segments.map((s, i) => {
        const x1 = s.from === null ? nx : x(s.from)
        const y1 = s.from === null ? mid : 0
        const x2 = s.to === null ? nx : x(s.to)
        const y2 = s.to === null ? mid : height
        const d =
          x1 === x2
            ? `M${x1} ${y1}L${x2} ${y2}`
            : `M${x1} ${y1}C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`
        return <path key={i} d={d} stroke={laneColor(s.color)} strokeWidth={2} fill="none" />
      })}
      {square ? (
        <rect
          x={nx - NODE / 2}
          y={mid - NODE / 2}
          width={NODE}
          height={NODE}
          fill={laneColor(row.color)}
          stroke={head ? 'var(--fg)' : 'none'}
          strokeWidth={2}
        />
      ) : (
        <circle
          cx={nx}
          cy={mid}
          r={NODE / 2}
          fill={laneColor(row.color)}
          stroke={head ? 'var(--fg)' : 'none'}
          strokeWidth={2}
        />
      )}
    </svg>
  )
}
