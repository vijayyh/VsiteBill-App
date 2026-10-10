import { useCallback, useEffect, useState } from 'react'
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { api, ApiError } from './api'

export interface QueuedUploadDetails {
  vendor: string
  /** The item names joined, and their quantities added up (what the waiting card shows). */
  item: string
  delivered: string
  poNumber: string
  /** The goods rows, as JSON text (see bill.ts). Missing on bills queued before items existed. */
  items?: string
  invoiceNumber?: string
  billDate?: string
  taxableAmount?: string
  cgst?: string
  sgst?: string
  igst?: string
  totalAmount?: string
  /** The photo reading the form was filled in from, if any (see readBill.ts). */
  ocrScanId?: number
}

const OPTIONAL_DETAILS = [
  'items',
  'invoiceNumber',
  'billDate',
  'taxableAmount',
  'cgst',
  'sgst',
  'igst',
  'totalAmount',
] as const

/** The form a bill is sent as, whether straight away or later from the queue. */
export function billForm(photo: Blob, filename: string, details: QueuedUploadDetails) {
  const form = new FormData()
  form.append('photo', photo, filename)
  form.append('vendor', details.vendor)
  form.append('item', details.item)
  form.append('delivered', details.delivered)
  form.append('poNumber', details.poNumber)
  for (const key of OPTIONAL_DETAILS) {
    const value = details[key]
    if (value) form.append(key, value)
  }
  if (details.ocrScanId) form.append('ocrScanId', String(details.ocrScanId))
  return form
}

export interface QueuedUpload extends QueuedUploadDetails {
  id: string
  projectId: string
  blob: Blob
  filename: string
  createdAt: string
}

interface SiteVerifyDB extends DBSchema {
  pendingUploads: {
    key: string
    value: QueuedUpload
    indexes: { 'by-project': string }
  }
}

let dbPromise: Promise<IDBPDatabase<SiteVerifyDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SiteVerifyDB>('siteverify', 1, {
      upgrade(db) {
        const store = db.createObjectStore('pendingUploads', { keyPath: 'id' })
        store.createIndex('by-project', 'projectId')
      },
    })
  }
  return dbPromise
}

type Listener = () => void
const listeners = new Set<Listener>()
function notifyListeners() {
  listeners.forEach((listener) => listener())
}

/** Subscribe to any change in the queue (item added, removed, or flushed). Returns an unsubscribe fn. */
export function subscribeQueue(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function queueUpload(
  projectId: string,
  blob: Blob,
  filename: string,
  details: QueuedUploadDetails,
): Promise<QueuedUpload> {
  const db = await getDb()
  const record: QueuedUpload = {
    id: crypto.randomUUID(),
    projectId,
    blob,
    filename,
    createdAt: new Date().toISOString(),
    ...details,
  }
  await db.put('pendingUploads', record)
  notifyListeners()
  return record
}

export async function listQueued(projectId?: string): Promise<QueuedUpload[]> {
  const db = await getDb()
  if (projectId) return db.getAllFromIndex('pendingUploads', 'by-project', projectId)
  return db.getAll('pendingUploads')
}

export async function removeQueued(id: string) {
  const db = await getDb()
  await db.delete('pendingUploads', id)
  notifyListeners()
}

let flushing = false

/**
 * Attempts to upload every queued photo. Stops at the first network-level failure
 * (we're presumably offline again) but drops any item the server outright rejects,
 * so one bad record can't block the rest of the queue forever.
 */
export async function flushQueue(): Promise<{ uploaded: number; remaining: number }> {
  if (flushing || !navigator.onLine) {
    return { uploaded: 0, remaining: (await listQueued()).length }
  }
  flushing = true
  let uploaded = 0
  try {
    for (const item of await listQueued()) {
      try {
        await api.post(`/api/projects/${item.projectId}/deliveries`, billForm(item.blob, item.filename, item))
        await removeQueued(item.id)
        uploaded += 1
      } catch (err) {
        if (err instanceof ApiError) {
          await removeQueued(item.id)
        } else {
          break
        }
      }
    }
  } finally {
    flushing = false
  }
  return { uploaded, remaining: (await listQueued()).length }
}

/** Live list of queued (not-yet-uploaded) photos — for one project, or all when omitted. */
export function useQueuedUploads(projectId?: string) {
  const [items, setItems] = useState<QueuedUpload[]>([])

  const refresh = useCallback(() => {
    listQueued(projectId).then(setItems)
  }, [projectId])

  useEffect(() => {
    refresh()
    return subscribeQueue(refresh)
  }, [refresh])

  return items
}

/**
 * Mount once near the app root. Flushes the queue on load (in case the device
 * was offline last time the app was open) and again every time the browser
 * reports it has regained connectivity — which is the moment a supervisor's
 * queued photos should actually reach the server.
 */
export function useAutoFlushOfflineQueue() {
  useEffect(() => {
    flushQueue()

    const onOnline = () => flushQueue()
    window.addEventListener('online', onOnline)

    // Belt-and-braces: on a flaky site connection the browser's online/offline
    // events don't always fire reliably, so also retry periodically.
    const interval = window.setInterval(flushQueue, 20_000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(interval)
    }
  }, [])
}
