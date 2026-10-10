import { SectionLabel } from './BillParts'
import { IconBill, IconCamera, IconPencil } from './icons'
import { changeLabel, changeValue } from '../lib/bill'
import { formatDateTime } from '../lib/format'
import type { Role } from '../lib/session'
import type { BillChange, BillHistoryEntry } from '../lib/types'

const ROLE_LABEL: Record<Role, string> = { supervisor: 'Supervisor', accountant: 'Office', admin: 'Admin' }

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function summary(entry: BillHistoryEntry) {
  const n = entry.changes.length
  if (entry.action === 'edited') return `Changed ${count(n, 'value', 'values')}`
  if (!entry.fromReading) return 'Sent · typed in by hand'
  if (n === 0) return 'Sent · kept everything as the photo read it'
  return `Sent · changed ${count(n, 'value', 'values')} from what the photo read`
}

function ChangeLine({ change }: { change: BillChange }) {
  const label = changeLabel(change.field)
  const from = changeValue(change.field, change.from)
  const to = changeValue(change.field, change.to)
  const wholeRow = /^items\.\d+$/.test(change.field)
  return (
    <li className="rounded-[10px] bg-white/60 ring-1 ring-white px-2.5 py-1.5 text-[12px] leading-snug">
      <div className="text-[10.5px] font-semibold text-label">
        {wholeRow ? `${label} ${change.from === null ? 'added' : 'removed'}` : label}
      </div>
      <div className="break-words">
        {wholeRow ? (
          <span className={change.from === null ? 'font-semibold' : 'text-ink-muted line-through'}>
            {change.from === null ? to : from}
          </span>
        ) : (
          <>
            <span className="text-ink-muted line-through">{from}</span>
            <span className="text-ink-faint mx-1.5">→</span>
            <span className="font-semibold">{to}</span>
          </>
        )}
      </div>
    </li>
  )
}

/**
 * Who sent the bill and every save since, newest first, with each value from → to: what the
 * supervisor changed from the photo reading, and what the office changed after. For the office
 * and admins (the API doesn't show it to supervisors).
 */
export function BillHistory({ history }: { history: BillHistoryEntry[] | undefined }) {
  return (
    <div>
      <SectionLabel title="History" right={<span className="text-[12px] text-ink-muted">Who changed what</span>} />
      <div className="glass rounded-[18px] p-3 flex flex-col gap-3.5">
        {history === undefined && <div className="text-[12.5px] text-ink-muted">Loading…</div>}
        {history?.length === 0 && (
          <div className="text-[12.5px] text-ink-muted leading-relaxed">
            Nothing recorded: this bill was sent before changes were tracked.
          </div>
        )}
        {history?.map((entry) => {
          const Icon = entry.action === 'edited' ? IconPencil : entry.fromReading ? IconCamera : IconBill
          return (
            <div key={entry.id} className="flex gap-2.5">
              <span className="w-7 h-7 rounded-full bg-info-bg flex items-center justify-center flex-shrink-0">
                <Icon size={13} stroke="var(--color-accent)" />
              </span>
              <div className="min-w-0 flex-grow">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[13px] font-bold truncate">
                    {entry.by.name}
                    <span className="font-semibold text-ink-muted"> · {ROLE_LABEL[entry.by.role]}</span>
                  </div>
                  <div className="text-[11px] text-ink-faint flex-shrink-0">{formatDateTime(entry.at)}</div>
                </div>
                <div className="text-[12px] text-ink-muted mt-px">{summary(entry)}</div>
                {entry.changes.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {entry.changes.map((change, i) => (
                      <ChangeLine key={i} change={change} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
