import { Link } from 'react-router-dom'
import { AuthImage } from './AuthImage'
import { StatusBadge } from './StatusBadge'
import { IconCloud } from './icons'
import { formatDateTime, formatQty } from '../lib/format'
import type { AdminDelivery } from '../lib/types'

/** Compact glass row for a bill in cross-project lists. */
export function BillRow({ bill, to, showThumb = false, showUploader = false, from }: {
  bill: AdminDelivery
  to: string
  showThumb?: boolean
  showUploader?: boolean
  /** Path the opened screen's back button should return to. */
  from?: string
}) {
  const mismatch = bill.ordered != null && bill.delivered != null && bill.ordered !== bill.delivered
  return (
    <Link to={to} state={from ? { from } : undefined} className="glass rounded-card flex items-center gap-3 p-2.5 pr-3.5">
      {showThumb && (
        <span className="w-[52px] h-[52px] rounded-[12px] bg-camera-bg flex-shrink-0 overflow-hidden ring-1 ring-white/70">
          {bill.photoUrl && <AuthImage src={bill.photoUrl} className="w-full h-full object-cover" />}
        </span>
      )}
      <div className={`flex-grow min-w-0 ${showThumb ? '' : 'pl-1'}`}>
        <div className="text-[13.5px] font-bold truncate">{bill.vendor || 'Vendor not entered'}</div>
        <div className="text-[11.5px] text-ink-muted truncate mt-px">
          {bill.project.code} · {bill.item || 'No item description'}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-faint mt-0.5">
          <span className="truncate">
            {showUploader && bill.uploadedBy ? `${bill.uploadedBy} · ` : ''}
            {formatDateTime(bill.uploadedAt)}
          </span>
          {bill.driveFileId && <IconCloud size={11} stroke="var(--color-success-text)" />}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <StatusBadge status={bill.status} />
        <span className={`text-[11px] font-semibold ${mismatch ? 'text-warning-text' : 'text-ink-muted'}`}>
          Qty {formatQty(bill.delivered)}
          {bill.ordered != null ? ` / ${formatQty(bill.ordered)}` : ''}
        </span>
      </div>
    </Link>
  )
}
