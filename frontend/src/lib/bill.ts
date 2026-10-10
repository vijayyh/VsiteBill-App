import type { Delivery, DeliveryItem } from './types'

/** How a value the photo reading filled in is marked: read clearly, or unclear and worth checking. */
export type Mark = 'read' | 'check'

/** A goods row as typed into the form (every value is text until it's sent). */
export interface ItemRow {
  description: string
  quantity: string
  unit: string
  rate: string
  amount: string
  /** Set when the photo reading filled this row in; cleared once it's edited. */
  mark?: Mark
}

const ROW_KEYS = ['description', 'quantity', 'unit', 'rate', 'amount'] as const

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

function text(value: number | string | null | undefined) {
  return value == null ? '' : String(value)
}

export function isEmptyRow(row: ItemRow) {
  return ROW_KEYS.every((key) => !row[key].trim())
}

export function filledRows(rows: ItemRow[]) {
  return rows.filter((row) => !isEmptyRow(row))
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

export function rowFromItem(item: Partial<Record<keyof DeliveryItem, string | number | null>>): ItemRow {
  return {
    description: text(item.description),
    quantity: text(item.quantity),
    unit: text(item.unit),
    rate: text(item.rate),
    amount: text(item.amount),
  }
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
