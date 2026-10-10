import { api } from './api'
import type { AmountKey } from './bill'
import type { DeliveryItem } from './types'

export interface ReadValue<T> {
  value: T
  confidence: number
}

/** One row of the goods table as read, with how sure the reading is of it. */
export type ReadItem = DeliveryItem & { confidence: number }

export type ReadText = 'vendor' | 'invoiceNumber' | 'billDate' | 'poNumber'

export interface BillReading {
  /** Sent with the bill, so the server can keep the reading next to what the office confirms. */
  scanId: number
  fields: Record<ReadText, ReadValue<string> | null> &
    Record<AmountKey, ReadValue<number> | null> & {
      items: ReadValue<ReadItem[]> | null
      /** The rows summed up: the item names, and the total quantity. */
      item: ReadValue<string> | null
      delivered: ReadValue<number> | null
    }
  /** Below this confidence a value is shown as "please check". */
  lowConfidence: number
}

/**
 * Asks the server to read a bill photo (OCR): vendor, bill number and date, PO number, the goods
 * table and the amounts. Returns null whenever it can't (no signal, reading not set up, or the
 * photo couldn't be read): the supervisor then types the details in as before.
 */
export async function readBill(photo: File): Promise<BillReading | null> {
  if (!navigator.onLine) return null
  try {
    const form = new FormData()
    form.append('photo', photo)
    return await api.post<BillReading>('/api/ocr/bill', form)
  } catch {
    return null
  }
}
