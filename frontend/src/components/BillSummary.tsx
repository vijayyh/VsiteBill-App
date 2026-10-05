import type { ReactNode } from 'react'
import { IconCloud } from './icons'
import { formatDateTime, formatQty } from '../lib/format'

/** The text body of a bill card: vendor/item, a badge, quantities, PO, note and a footer line. */
export function BillSummary({
  vendor,
  item,
  badge,
  delivered,
  ordered,
  poNumber,
  note,
  byline,
  timestamp,
  inDrive = false,
}: {
  vendor: string
  item: string
  badge: ReactNode
  delivered: number | null
  ordered?: number | null
  poNumber: string | null
  note?: string | null
  byline?: string | null
  timestamp: string
  inDrive?: boolean
}) {
  const mismatch = ordered != null && delivered != null && ordered !== delivered

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] font-bold truncate">{vendor || 'Vendor not entered'}</div>
          <div className="text-[12px] text-ink-muted truncate mt-px">{item || 'No item description'}</div>
        </div>
        {badge}
      </div>

      <div className={`grid gap-2 mt-2.5 ${ordered === undefined ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <div>
          <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wide">Delivered</div>
          <div className={`text-[13px] font-bold ${mismatch ? 'text-warning-text' : ''}`}>{formatQty(delivered)}</div>
        </div>
        {ordered !== undefined && (
          <div>
            <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wide">Ordered</div>
            <div className="text-[13px] font-bold">{formatQty(ordered)}</div>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wide">PO no.</div>
          <div className="text-[13px] font-bold truncate">{poNumber || '—'}</div>
        </div>
      </div>

      {note && <div className="text-[11.5px] text-ink-muted italic mt-2 line-clamp-2">“{note}”</div>}

      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-white/80 text-[11px] text-ink-faint">
        <span className="truncate">
          {byline ? `${byline} · ` : ''}
          {formatDateTime(timestamp)}
        </span>
        {inDrive && (
          <span className="flex items-center gap-1 font-semibold text-success-text flex-shrink-0">
            <IconCloud size={12} stroke="var(--color-success-text)" />
            In Drive
          </span>
        )}
      </div>
    </>
  )
}
