import { File } from 'expo-file-system'
import { api } from './api'
import type { AmountKey } from './bill'
import { isOnline } from './offlineQueue'
import type { DeliveryItem } from './types'

// Same as the web app's frontend/src/lib/readBill.ts: the server reads the bill photo (OCR) and
// the form fills itself in from what it found.

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
  /** Pages (1-based) that couldn't be read: the fields cover the other pages only. */
  failedPages?: number[]
}

/**
 * Asks the server to read a bill photo: vendor, bill number and date, PO number, the goods table
 * and the amounts. A bill in several pages is read as one bill (all pages, in order). Returns null
 * whenever it can't (no signal, reading not set up, or the photo couldn't be read): the
 * supervisor then types the details in as before.
 */
export async function readBill(pages: { uri: string; filename: string }[]): Promise<BillReading | null> {
  if (!(await isOnline())) return null
  try {
    const form = new FormData()
    // The same photo parts the bill itself is sent with (see billForm in offlineQueue.ts).
    for (const page of pages) {
      const photo = { uri: page.uri, name: page.filename, type: 'image/jpeg', bytes: () => new File(page.uri).bytes() }
      form.append('photo', photo as unknown as Blob)
    }
    return await api.post<BillReading>('/api/ocr/bill', form)
  } catch {
    return null
  }
}
