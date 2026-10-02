import { STATUS_META } from '../lib/status'
import type { DeliveryStatus } from '../lib/types'

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full pl-2 pr-2.5 py-[3px] whitespace-nowrap ${meta.text} ${meta.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}
