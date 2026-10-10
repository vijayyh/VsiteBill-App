import type { InputHTMLAttributes, ReactNode } from 'react'
import { IconCamera, IconCheck, IconAlertTriangle, IconClose, IconPlus } from './icons'
import {
  AMOUNT_FIELDS,
  amountsCheck,
  emptyRow,
  formatMoney,
  isEmptyRow,
  sharedUnit,
  totalQuantity,
  type AmountKey,
  type Amounts,
  type ItemRow,
  type Mark,
} from '../lib/bill'
import { formatQty } from '../lib/format'

/** The mark beside the label of a value the photo reading filled in (it doesn't change the label's height). */
export function ReadMark({ mark }: { mark?: Mark }) {
  if (mark === 'check') {
    return (
      <span className="-my-[3px] text-[9.5px] font-bold text-warning-text bg-warning-bg rounded-full px-2 py-[3px]" title="Unclear on the photo">
        CHECK
      </span>
    )
  }
  if (mark === 'read') {
    return (
      <span className="-my-[3px] w-[20px] h-[20px] rounded-full bg-info-bg flex items-center justify-center" title="Filled in from the photo">
        <IconCamera size={11} stroke="var(--color-accent)" />
      </span>
    )
  }
  return null
}

/** A field's label with the photo reading's mark after it. */
export function MarkedLabel({ label, mark }: { label: string; mark?: Mark }) {
  return (
    <>
      {label}
      <ReadMark mark={mark} />
    </>
  )
}

/** Small caps heading over a group of fields, with an optional note at its right. */
export function SectionLabel({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-2 mb-2.5 mx-1">
      <div className="text-[12px] font-bold text-ink-muted uppercase tracking-wide">{title}</div>
      {right}
    </div>
  )
}

const smallInput =
  'w-full rounded-[12px] glass-strong px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40'
const warnOutline = 'outline-2 outline-warning-text/70'

function SmallField({
  id,
  label,
  invalid = false,
  ...input
}: { id: string; label: string; invalid?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[11px] font-semibold text-label mb-1 ml-2">
        {label}
      </label>
      <input id={id} {...input} className={`${smallInput} ${invalid ? warnOutline : ''}`} />
    </div>
  )
}

/**
 * The goods on a bill, one card per item: a single-item bill has one, a multi-item bill one per
 * line of its table. Rows can be added and removed; the quantities add up to "delivered".
 */
export function ItemsEditor({
  rows,
  onChange,
  showErrors = false,
  flagged = false,
}: {
  rows: ItemRow[]
  onChange: (rows: ItemRow[]) => void
  showErrors?: boolean
  /** The office was asked to double-check the quantities. */
  flagged?: boolean
}) {
  const total = totalQuantity(rows)
  const unit = sharedUnit(rows)
  const nothingYet = rows.every(isEmptyRow)

  function edit(index: number, key: keyof Omit<ItemRow, 'mark'>, value: string) {
    // Editing a row the photo filled in makes it the person's own.
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value, mark: undefined } : row)))
  }

  return (
    <div>
      <SectionLabel
        title={rows.length > 1 ? `Items · ${rows.length}` : 'Item'}
        right={
          <div className="text-[12px] text-ink-muted flex items-center gap-1.5">
            {flagged && (
              <span className="text-[9px] font-bold text-warning-text bg-warning-bg rounded px-[5px] py-px">DOUBLE-CHECK</span>
            )}
            {total !== null && (
              <span>
                Total qty <span className="font-bold text-ink">{formatQty(total)}</span>
                {unit ? ` ${unit}` : ''}
              </span>
            )}
          </div>
        }
      />
      <div className="flex flex-col gap-2.5">
        {rows.map((row, index) => {
          const filled = !isEmptyRow(row) || (nothingYet && index === 0)
          const n = index + 1
          return (
            <div
              key={index}
              className={`glass rounded-[18px] p-3 flex flex-col gap-2.5 ${row.mark === 'check' ? 'ring-1 ring-warning-border' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 min-h-[24px]">
                <div className="text-[12px] font-bold text-label flex items-center gap-1.5 ml-1">
                  {rows.length > 1 ? `Item ${n}` : 'Description'}
                  <ReadMark mark={row.mark} />
                </div>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    aria-label={`Remove item ${n}`}
                    className="w-7 h-7 rounded-full bg-white/70 ring-1 ring-black/[0.05] flex items-center justify-center"
                  >
                    <IconClose size={13} stroke="var(--color-ink-muted)" strokeWidth={2.4} />
                  </button>
                )}
              </div>
              <textarea
                aria-label={`Item ${n} description`}
                rows={Math.min(4, Math.max(1, Math.ceil(row.description.length / 34)))}
                placeholder="e.g. OPC 53 Grade Cement, 50kg bags"
                value={row.description}
                onChange={(e) => edit(index, 'description', e.target.value)}
                // Grows to fit a long description where the browser can; `rows` is the fallback.
                className={`${smallInput} resize-none leading-snug field-sizing-content max-h-[180px] ${
                  showErrors && filled && !row.description.trim() ? warnOutline : ''
                }`}
              />
              <div className="grid grid-cols-2 gap-2">
                <SmallField
                  id={`item-${n}-qty`}
                  aria-label={`Item ${n} quantity`}
                  label="Quantity"
                  inputMode="decimal"
                  placeholder="e.g. 480"
                  invalid={showErrors && filled && !row.quantity.trim()}
                  value={row.quantity}
                  onChange={(e) => edit(index, 'quantity', e.target.value)}
                />
                <SmallField
                  id={`item-${n}-unit`}
                  aria-label={`Item ${n} unit`}
                  label="Unit"
                  placeholder="e.g. Bags"
                  value={row.unit}
                  onChange={(e) => edit(index, 'unit', e.target.value)}
                />
                <SmallField
                  id={`item-${n}-rate`}
                  aria-label={`Item ${n} rate`}
                  label="Rate (₹)"
                  inputMode="decimal"
                  placeholder="If printed"
                  value={row.rate}
                  onChange={(e) => edit(index, 'rate', e.target.value)}
                />
                <SmallField
                  id={`item-${n}-amount`}
                  aria-label={`Item ${n} amount`}
                  label="Amount (₹)"
                  inputMode="decimal"
                  placeholder="If printed"
                  value={row.amount}
                  onChange={(e) => edit(index, 'amount', e.target.value)}
                />
              </div>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => onChange([...rows, emptyRow()])}
          className="flex items-center justify-center gap-1.5 rounded-[18px] border-2 border-dashed border-black/[0.09] text-accent text-[13px] font-bold py-3"
        >
          <IconPlus size={15} stroke="var(--color-accent)" strokeWidth={2.6} />
          Add another item
        </button>
      </div>
    </div>
  )
}

/**
 * The money a bill states, laid out like the foot of the bill: taxable amount, GST, total. All
 * optional (a challan has none), with a check that they add up once they're filled in.
 */
export function AmountsCard({
  amounts,
  onChange,
  marks = {},
}: {
  amounts: Amounts
  onChange: (key: AmountKey, value: string) => void
  marks?: Partial<Record<AmountKey, Mark>>
}) {
  const check = amountsCheck(amounts)
  return (
    <div>
      <SectionLabel title="Amounts" right={<span className="text-[12px] text-ink-muted">If printed on the bill</span>} />
      <div className="glass rounded-[18px] px-3 py-1.5">
        {AMOUNT_FIELDS.map(({ key, label }) => {
          const total = key === 'totalAmount'
          return (
            <div
              key={key}
              className={`flex items-center justify-between gap-2 py-1.5 ${total ? 'border-t border-black/[0.07] mt-1 pt-2.5' : ''}`}
            >
              <label
                htmlFor={`amount-${key}`}
                className={`flex items-center gap-1.5 whitespace-nowrap text-[13px] ${total ? 'font-bold' : 'text-label font-semibold'}`}
              >
                {label}
                <ReadMark mark={marks[key]} />
              </label>
              <div className="w-[124px] flex-shrink-0">
                <input
                  id={`amount-${key}`}
                  inputMode="decimal"
                  placeholder="—"
                  value={amounts[key]}
                  onChange={(e) => onChange(key, e.target.value)}
                  className={`${smallInput} text-right ${total ? 'font-bold' : ''} ${marks[key] === 'check' ? warnOutline : ''}`}
                />
              </div>
            </div>
          )
        })}
        {check && (
          <div
            className={`flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-full mt-1.5 mb-1 py-1.5 ${
              check.addsUp ? 'text-success-text bg-success-bg' : 'text-warning-text bg-warning-bg'
            }`}
          >
            {check.addsUp ? (
              <IconCheck size={13} stroke="var(--color-success-text)" strokeWidth={2.6} />
            ) : (
              <IconAlertTriangle size={13} stroke="var(--color-warning-text)" strokeWidth={2.4} />
            )}
            {check.addsUp
              ? 'Taxable amount + GST = total'
              : `Taxable amount + GST is ${formatMoney(Math.abs(check.difference))} ${check.difference > 0 ? 'less than' : 'more than'} the total`}
          </div>
        )}
      </div>
    </div>
  )
}
