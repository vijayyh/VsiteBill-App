import { STATUS_META } from './status'
import type { BillHistoryEntry, Delivery, DeliveryItem, DeliveryStatus } from './types'

/**
 * How a value is marked beside its label: filled in from the photo and read clearly ("read"),
 * filled in but unclear ("check"), or changed from what it was (from the photo reading, or from
 * what was saved) ("edited").
 */
export type Mark = 'read' | 'check' | 'edited'

export const ROW_KEYS = ['description', 'quantity', 'unit', 'rate', 'amount'] as const
export type RowKey = (typeof ROW_KEYS)[number]
export type RowValues = Record<RowKey, string>

/** A goods row as typed into the form (every value is text until it's sent). */
export interface ItemRow extends RowValues {
  /** How the photo reading filled this row in, if it did. */
  mark?: 'read' | 'check'
  /** The values the row started with (as read from the photo, or as saved): what "edited" compares to. */
  original?: RowValues
}

export type AmountKey = 'taxableAmount' | 'cgst' | 'sgst' | 'igst' | 'totalAmount'
export type Amounts = Record<AmountKey, string>

export const AMOUNT_FIELDS: { key: AmountKey; label: string }[] = [
  { key: 'taxableAmount', label: 'Taxable amount' },
  { key: 'cgst', label: 'CGST' },
  { key: 'sgst', label: 'SGST' },
  { key: 'igst', label: 'IGST' },
  { key: 'totalAmount', label: 'Total amount' },
]

export function emptyRow(): ItemRow {
  return { description: '', quantity: '', unit: '', rate: '', amount: '' }
}

export function emptyAmounts(): Amounts {
  return { taxableAmount: '', cgst: '', sgst: '', igst: '', totalAmount: '' }
}

/** "1,750.94" → 1750.94; empty or unreadable → null. */
export function toNumber(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '')
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/**
 * Keeps only what a number can hold: digits and one decimal point. Grouping commas and spaces in
 * a pasted "1,750.94" are dropped quietly; anything else (letters, ₹, -, a second point) is
 * dropped and reported, so the field can say "numbers only".
 */
export function numberOnly(input: string): { value: string; rejected: boolean } {
  let value = ''
  let rejected = false
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') value += ch
    else if (ch === '.' && !value.includes('.')) value += ch
    else if (ch !== ',' && ch.trim() !== '') rejected = true
  }
  return { value, rejected }
}

const NUMERIC = /^[\d,.\s₹]+$/

/** Two values as typed are the same: equal numbers ("711450" and "711450.00"), or equal text. */
export function sameValue(a: string, b: string) {
  if (NUMERIC.test(a) && NUMERIC.test(b)) return toNumber(a) === toNumber(b)
  return a.trim() === b.trim()
}

function text(value: number | string | null | undefined) {
  return value == null ? '' : String(value)
}

export function isEmptyRow(row: ItemRow) {
  return ROW_KEYS.every((key) => !row[key].trim())
}

export function filledRows(rows: ItemRow[]) {
  return rows.filter((row) => !isEmptyRow(row))
}

/** The row's fields that differ from what it started with. */
export function changedKeys(row: ItemRow): Set<RowKey> {
  const { original } = row
  return new Set(original ? ROW_KEYS.filter((key) => !sameValue(row[key], original[key])) : [])
}

/** The quantities added up (null when none is filled in): the "delivered" the office compares with the PO. */
export function totalQuantity(rows: ItemRow[]): number | null {
  const quantities = rows.map((row) => toNumber(row.quantity)).filter((q): q is number => q !== null)
  if (quantities.length === 0) return null
  return Math.round(quantities.reduce((sum, q) => sum + q, 0) * 1000) / 1000
}

/** The unit all rows share ("CU.MT"), or null when they differ or none is given. */
export function sharedUnit(rows: ItemRow[]): string | null {
  const units = new Set(filledRows(rows).map((row) => row.unit.trim().toUpperCase()))
  return units.size === 1 ? filledRows(rows)[0].unit.trim() || null : null
}

export function itemSummary(rows: ItemRow[]) {
  return filledRows(rows)
    .map((row) => row.description.trim())
    .filter(Boolean)
    .join(', ')
}

/** What's still missing before a bill can be sent or matched, as words for a message. */
export function missingItemDetails(rows: ItemRow[]): string[] {
  const filled = filledRows(rows)
  const missing: string[] = []
  if (filled.length === 0 || filled.some((row) => !row.description.trim())) missing.push('item description')
  if (filled.length === 0 || filled.some((row) => !row.quantity.trim())) missing.push('quantity')
  return missing
}

/** The rows as the API takes them. */
export function itemsPayload(rows: ItemRow[]) {
  return filledRows(rows).map((row) => ({
    description: row.description.trim(),
    quantity: row.quantity.trim(),
    unit: row.unit.trim(),
    rate: row.rate.trim(),
    amount: row.amount.trim(),
  }))
}

/** A row from the API (or the photo reading), remembering its values as where it started. */
export function rowFromItem(item: Partial<Record<keyof DeliveryItem, string | number | null>>): ItemRow {
  const values: RowValues = {
    description: text(item.description),
    quantity: text(item.quantity),
    unit: text(item.unit),
    rate: text(item.rate),
    amount: text(item.amount),
  }
  return { ...values, original: { ...values } }
}

export function amountsFromDelivery(delivery: Delivery): Amounts {
  return {
    taxableAmount: text(delivery.taxableAmount),
    cgst: text(delivery.cgst),
    sgst: text(delivery.sgst),
    igst: text(delivery.igst),
    totalAmount: text(delivery.totalAmount),
  }
}

/**
 * Whether the bill's amounts add up: taxable amount plus GST against the total, allowing for the
 * rounding off bills print. Null until all of them are filled in.
 */
export function amountsCheck(amounts: Amounts): { addsUp: boolean; difference: number } | null {
  const taxable = toNumber(amounts.taxableAmount)
  const total = toNumber(amounts.totalAmount)
  const taxes = (['cgst', 'sgst', 'igst'] as const).map((key) => toNumber(amounts[key])).filter((t): t is number => t !== null)
  if (taxable === null || total === null || taxes.length === 0) return null
  const difference = Math.round((total - taxable - taxes.reduce((sum, t) => sum + t, 0)) * 100) / 100
  return { addsUp: Math.abs(difference) <= 1, difference }
}

export function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── The bill's history ──────────────────────────────────────────────────────────────────────────

/** Every field any save changed ("vendor", "items.2.quantity", "items.3"), to mark them edited. */
export function editedFields(history: BillHistoryEntry[]): Set<string> {
  return new Set(history.flatMap((entry) => entry.changes.map((change) => change.field)))
}

/** Whether row n (1-based) or one of its fields was changed by an earlier save. */
export function rowWasEdited(fields: Set<string>, n: number) {
  return [...fields].some((field) => field === `items.${n}` || field.startsWith(`items.${n}.`))
}

const FIELD_LABELS: Record<string, string> = {
  vendor: 'Vendor',
  invoiceNumber: 'Bill no.',
  billDate: 'Bill date',
  poNumber: 'PO number',
  ordered: 'Ordered qty',
  note: 'Note',
  status: 'Status',
  ...Object.fromEntries(AMOUNT_FIELDS.map(({ key, label }) => [key, label])),
}

/** "items.2.quantity" → "Item 2 quantity"; "taxableAmount" → "Taxable amount". */
export function changeLabel(field: string) {
  const item = /^items\.(\d+)(?:\.(\w+))?$/.exec(field)
  if (item) return item[2] ? `Item ${item[1]} ${item[2]}` : `Item ${item[1]}`
  return FIELD_LABELS[field] ?? field
}

/** A recorded value as people read it. */
export function changeValue(field: string, value: string | number | null) {
  if (value === null || value === '') return 'empty'
  if (field === 'status') return STATUS_META[value as DeliveryStatus]?.label ?? String(value)
  if (typeof value === 'number') {
    const money = AMOUNT_FIELDS.some(({ key }) => key === field) || /\.(rate|amount)$/.test(field)
    return money ? formatMoney(value) : value.toLocaleString('en-IN')
  }
  if (field === 'billDate') {
    const date = new Date(`${value}T00:00:00`)
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return String(value)
}
