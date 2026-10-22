import type { GraphRow, GraphSegment } from '../../protocol/types'
import { laneColor } from './laneColor'

export const LANE_WIDTH = 14
const NODE = 10
/** A jump over several lanes leaves and reaches a lane vertically for this part of a row. */
const STUB = 1 / 6

type Props = { row: GraphRow; height: number; width: number; square: boolean; head: boolean }

/**
 * Each line runs from the middle of the row above through this row's middle to the middle of the
 * row below, clipped to this row (Git Extensions' diagonals); the row above and below draw the
 * rest of the same path.
 */
export function GraphCell({ row, height, width, square, head }: Props) {
  const x = (lane: number) => lane * LANE_WIDTH + LANE_WIDTH / 2
  const mid = height / 2
  const nx = x(row.lane)
  return (
    <svg width={width} height={height} style={{ flex: 'none', display: 'block', overflow: 'hidden' }}>
      {row.segments.map((s, i) => (
        <path
          key={i}
          d={path(s, row.lane, height, x)}
          stroke={laneColor(s.color)}
          strokeWidth={2}
          strokeLinejoin="round"
          fill="none"
        />
      ))}
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
        <circle cx={nx} cy={mid} r={NODE / 2} fill={laneColor(row.color)} stroke={head ? 'var(--fg)' : 'none'} strokeWidth={2} />
      )}
    </svg>
  )
}

function path(s: GraphSegment, nodeLane: number, h: number, x: (lane: number) => number): string {
  const mid = h / 2
  const stub = h * STUB
  const atNode = s.center === nodeLane && (s.start === null || s.end === null)
  const c = x(s.center)
  const points: [number, number][] = []
  if (s.start !== null) {
    const a = x(s.start)
    const jump = Math.abs(s.start - s.center) > 1
    points.push([a, mid - h])
    if (jump && !s.fromNode) points.push([a, mid - h + stub])
    if (jump && !atNode) points.push([c, mid - stub])
  }
  points.push([c, mid])
  if (s.end !== null) {
    const e = x(s.end)
    const jump = Math.abs(s.end - s.center) > 1
    if (jump && !atNode) points.push([c, mid + stub])
    if (jump && !s.toNode) points.push([e, mid + h - stub])
    points.push([e, mid + h])
  }
  return points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join('')
}
