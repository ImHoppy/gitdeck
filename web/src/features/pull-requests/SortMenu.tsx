import { useRef, useState } from 'react'
import type { PrOrder, PrSort } from '../../protocol/github'
import { DropButton } from '../../ui/DropButton/DropButton'
import { Menu, type MenuItem } from '../../ui/Menu/Menu'

type Props = {
  sort: PrSort
  order: PrOrder
  onChange: (sort: PrSort, order: PrOrder) => void
}

const SORTS: [PrSort, string][] = [
  ['created', 'Created on'],
  ['updated', 'Last updated'],
  ['comments', 'Total comments'],
  ['bestMatch', 'Best match'],
]

/** GitHub's "Sort by" and "Order"; best match has no order. */
export function SortMenu({ sort, order, onChange }: Props) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const owner = useRef<HTMLSpanElement>(null)
  const caption = sort === 'bestMatch' ? 'Best match' : sort === 'comments' ? (order === 'desc' ? 'Most commented' : 'Least commented') : order === 'desc' ? 'Newest' : 'Oldest'
  const items: MenuItem[] = [
    { key: 'sortBy', heading: 'Sort by' },
    ...SORTS.map(([s, label]): MenuItem => ({ key: s, label, checked: s === sort, onSelect: () => onChange(s, order) })),
    'separator',
    { key: 'order', heading: 'Order' },
    { key: 'asc', label: 'Oldest', icon: 'sortAsc', checked: order === 'asc', disabled: sort === 'bestMatch', onSelect: () => onChange(sort, 'asc') },
    { key: 'desc', label: 'Newest', icon: 'sortDesc', checked: order === 'desc', disabled: sort === 'bestMatch', onSelect: () => onChange(sort, 'desc') },
  ]

  return (
    <>
      <span ref={owner}>
        <DropButton icon={order === 'asc' && sort !== 'bestMatch' ? 'sortAsc' : 'sortDesc'} label={caption} title="Sort the list" onOpen={(p) => setAt(at ? null : p)} />
      </span>
      {at && <Menu at={at} onClose={() => setAt(null)} owner={owner} items={items} />}
    </>
  )
}
