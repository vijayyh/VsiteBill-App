import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { IconCamera, IconCheck, IconAlertTriangle, IconClose, IconPencil, IconPlus } from './icons'
import {
  AMOUNT_FIELDS,
  amountsCheck,
  changedKeys,
  emptyRow,
  formatMoney,
  isEmptyRow,
  numberOnly,
  rowWasEdited,
  sharedUnit,
  totalQuantity,
  type AmountKey,
  type Amounts,
  type ItemRow,
  type Mark,
  type RowKey,
} from '../lib/bill'
import { formatQty } from '../lib/format'

/** The mark beside a value's label (it doesn't change the label's height). */
export function ReadMark({ mark }: { mark?: Mark }) {
  if (mark === 'edited') {
    return (
      <span
        className="-my-[3px] flex items-center gap-1 text-[9.5px] font-bold text-accent bg-info-bg rounded-full px-2 py-[3px]"
        title="Changed from what the photo read or what was saved"
      >
        <IconPencil size={9} stroke="var(--color-accent)" strokeWidth={2.6} />
        EDITED
      </span>
    )
  }
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

/** A field's label with its mark after it. */
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

/** Shown under a number box when something other than a number was typed (and dropped). */
export function NumbersOnly({ className = '' }: { className?: string }) {
  return (
    <div role="alert" className={`text-[11px] font-semibold text-warning-text mt-1 ${className}`}>
      Numbers only
    </div>
  )
}

const smallInput =
  'w-full rounded-[12px] glass-strong px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40'
const warnOutline = 'outline-2 outline-warning-text/70'

/**
 * A box for a number: anything that isn't a digit or the one decimal point is dropped as it's
 * typed or pasted, with a short "Numbers only" under the box when that happens.
 */
function NumberInput({
  value,
  onChange,
  className = '',
  hintClassName = '',
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  hintClassName?: string
}) {
  const [rejected, setRejected] = useState(false)
  return (
    <>
      <input
        {...input}
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const typed = numberOnly(e.target.value)
          setRejected(typed.rejected)
          onChange(typed.value)
        }}
        onBlur={() => setRejected(false)}
        className={`${className} ${rejected ? warnOutline : ''}`}
      />
      {rejected && <NumbersOnly className={hintClassName} />}
    </>
  )
}

function SmallField({
  id,
  label,
  value,
  onChange,
  numeric = false,
  mark,
  invalid = false,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  numeric?: boolean
  mark?: Mark
  invalid?: boolean
}) {
  const className = `${smallInput} ${invalid ? warnOutline : ''}`
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[11px] font-semibold text-label mb-1 ml-2 min-h-[16px]">
        {label}
        <ReadMark mark={mark} />
      </label>
      {numeric ? (
        <NumberInput id={id} {...input} value={value} onChange={onChange} className={className} hintClassName="ml-2" />
      ) : (
        <input id={id} {...input} value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </div>
  )
}

const ITEM_FIELDS: { key: Exclude<RowKey, 'description'>; label: string; placeholder: string; numeric: boolean }[] = [
  { key: 'quantity', label: 'Quantity', placeholder: 'e.g. 480', numeric: true },
  { key: 'unit', label: 'Unit', placeholder: 'e.g. Bags', numeric: false },
  { key: 'rate', label: 'Rate (₹)', placeholder: 'If printed', numeric: true },
  { key: 'amount', label: 'Amount (₹)', placeholder: 'If printed', numeric: true },
]

/**
 * The goods on a bill, one card per item: a single-item bill has one, a multi-item bill one per
 * line of its table. Rows can be added and removed; the quantities add up to "delivered". A value
 * changed from where its row started (the photo reading, or what was saved), or by an earlier
 * save (`editedFields`, from the bill's history), is marked EDITED.
 */
export function ItemsEditor({
  rows,
  onChange,
  showErrors = false,
  flagged = false,
  editedFields,
}: {
  rows: ItemRow[]
  onChange: (rows: ItemRow[]) => void
  showErrors?: boolean
  /** The office was asked to double-check the quantities. */
  flagged?: boolean
  editedFields?: Set<string>
}) {
  const total = totalQuantity(rows)
  const unit = sharedUnit(rows)
  const nothingYet = rows.every(isEmptyRow)

  function edit(index: number, key: RowKey, value: string) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
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
          const changed = changedKeys(row)
          const fieldMark = (key: RowKey): Mark | undefined =>
            changed.has(key) || editedFields?.has(`items.${n}.${key}`) ? 'edited' : undefined
          const rowMark: Mark | undefined =
            changed.size > 0 || (editedFields && rowWasEdited(editedFields, n)) ? 'edited' : row.mark
          return (
            <div
              key={index}
              className={`glass rounded-[18px] p-3 flex flex-col gap-2.5 ${rowMark === 'check' ? 'ring-1 ring-warning-border' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 min-h-[24px]">
                <div className="text-[12px] font-bold text-label flex items-center gap-1.5 ml-1">
                  {rows.length > 1 ? `Item ${n}` : 'Description'}
                  <ReadMark mark={rowMark} />
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
                {ITEM_FIELDS.map(({ key, label, placeholder, numeric }) => (
                  <SmallField
                    key={key}
                    id={`item-${n}-${key}`}
                    aria-label={`Item ${n} ${key}`}
                    label={label}
                    placeholder={placeholder}
                    numeric={numeric}
                    mark={fieldMark(key)}
                    invalid={key === 'quantity' && showErrors && filled && !row.quantity.trim()}
                    value={row[key]}
                    onChange={(value) => edit(index, key, value)}
                  />
                ))}
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
 * optional (a challan has none), numbers only, with a check that they add up once filled in.
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
                <NumberInput
                  id={`amount-${key}`}
                  aria-label={label}
                  placeholder="—"
                  value={amounts[key]}
                  onChange={(value) => onChange(key, value)}
                  className={`${smallInput} text-right ${total ? 'font-bold' : ''} ${marks[key] === 'check' ? warnOutline : ''}`}
                  hintClassName="text-right mr-1"
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
