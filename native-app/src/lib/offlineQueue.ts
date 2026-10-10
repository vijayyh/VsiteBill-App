import NetInfo from '@react-native-community/netinfo'
import { Directory, File, Paths } from 'expo-file-system'
import * as SQLite from 'expo-sqlite'
import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { api, ApiError } from './api'

// Same behaviour as the web app's offline queue (frontend/src/lib/offlineQueue.ts): a bill made
// with no signal is stored on the phone and sent automatically once there's a connection. Here
// the details go in SQLite and the photo is copied into the app's own document storage (the
// system may clear the cache, never this).

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

/** The details beyond the first four, kept together as JSON in the queue's `details` column. */
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
type ExtraDetails = Partial<Pick<QueuedUploadDetails, (typeof OPTIONAL_DETAILS)[number] | 'ocrScanId'>>

function extraDetails(details: QueuedUploadDetails): ExtraDetails {
  const extra: ExtraDetails = {}
  for (const key of OPTIONAL_DETAILS) if (details[key]) extra[key] = details[key]
  if (details.ocrScanId) extra.ocrScanId = details.ocrScanId
  return extra
}

export interface QueuedUpload extends QueuedUploadDetails {
  id: string
  projectId: string
  /** Local file of the photo, ready to show or send. */
  uri: string
  filename: string
  createdAt: string
}

interface Row {
  id: string
  project_id: string
  file_uri: string
  filename: string
  vendor: string
  item: string
  delivered: string
  po_number: string
  created_at: string
  details: string | null
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('siteverify.db')
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS pending_uploads (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          file_uri TEXT NOT NULL,
          filename TEXT NOT NULL,
          vendor TEXT NOT NULL,
          item TEXT NOT NULL,
          delivered TEXT NOT NULL,
          po_number TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS pending_uploads_project ON pending_uploads (project_id);
      `)
      // Added with the items table and amounts: a phone may still hold bills queued before then.
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(pending_uploads)')
      if (!columns.some((column) => column.name === 'details')) {
        await db.execAsync('ALTER TABLE pending_uploads ADD COLUMN details TEXT')
      }
      return db
    })()
  }
  return dbPromise
}

function parseDetails(text: string | null): ExtraDetails {
  try {
    return text ? (JSON.parse(text) as ExtraDetails) : {}
  } catch {
    return {}
  }
}

const toUpload = (row: Row): QueuedUpload => ({
  id: row.id,
  projectId: row.project_id,
  uri: row.file_uri,
  filename: row.filename,
  vendor: row.vendor,
  item: row.item,
  delivered: row.delivered,
  poNumber: row.po_number,
  createdAt: row.created_at,
  ...parseDetails(row.details),
})

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

function pendingDir() {
  const dir = new Directory(Paths.document, 'pending-uploads')
  if (!dir.exists) dir.create({ intermediates: true })
  return dir
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function queueUpload(
  projectId: string,
  photoUri: string,
  filename: string,
  details: QueuedUploadDetails,
): Promise<QueuedUpload> {
  const db = await getDb()
  const id = newId()
  const stored = new File(pendingDir(), `${id}.jpg`)
  new File(photoUri).copy(stored)
  const record: QueuedUpload = {
    id,
    projectId,
    uri: stored.uri,
    filename,
    createdAt: new Date().toISOString(),
    ...details,
  }
  await db.runAsync(
    `INSERT INTO pending_uploads (id, project_id, file_uri, filename, vendor, item, delivered, po_number, created_at, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      projectId,
      record.uri,
      filename,
      details.vendor,
      details.item,
      details.delivered,
      details.poNumber,
      record.createdAt,
      JSON.stringify(extraDetails(details)),
    ],
  )
  notifyListeners()
  return record
}

export async function listQueued(projectId?: string): Promise<QueuedUpload[]> {
  const db = await getDb()
  const rows = projectId
    ? await db.getAllAsync<Row>('SELECT * FROM pending_uploads WHERE project_id = ? ORDER BY created_at', [projectId])
    : await db.getAllAsync<Row>('SELECT * FROM pending_uploads ORDER BY created_at')
  return rows.map(toUpload)
}

export async function removeQueued(item: QueuedUpload) {
  const db = await getDb()
  await db.runAsync('DELETE FROM pending_uploads WHERE id = ?', [item.id])
  try {
    const file = new File(item.uri)
    if (file.exists) file.delete()
  } catch {
    // The row is gone either way; a leftover file is harmless.
  }
  notifyListeners()
}

/** The bill's form data, as the API expects it (same fields as the web app sends). */
export function billForm(photoUri: string, filename: string, details: QueuedUploadDetails) {
  const form = new FormData()
  // The photo part, readable by both fetch implementations: Expo's default fetch reads the file
  // through bytes(); React Native's own fetch sends the { uri, name, type } shape. Either way the
  // server gets a JPEG with this filename, as the browser sends it on the web.
  const photo = { uri: photoUri, name: filename, type: 'image/jpeg', bytes: () => new File(photoUri).bytes() }
  form.append('photo', photo as unknown as Blob)
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

export async function isOnline() {
  const state = await NetInfo.fetch()
  return state.isConnected !== false && state.isInternetReachable !== false
}

let flushing = false

/**
 * Attempts to upload every queued photo. Stops at the first network-level failure
 * (we're presumably offline again) but drops any item the server outright rejects,
 * so one bad record can't block the rest of the queue forever.
 */
export async function flushQueue(): Promise<{ uploaded: number; remaining: number }> {
  if (flushing || !(await isOnline())) {
    return { uploaded: 0, remaining: (await listQueued()).length }
  }
  flushing = true
  let uploaded = 0
  try {
    for (const item of await listQueued()) {
      try {
        await api.post(`/api/projects/${item.projectId}/deliveries`, billForm(item.uri, item.filename, item))
        await removeQueued(item)
        uploaded += 1
      } catch (err) {
        if (err instanceof ApiError) {
          await removeQueued(item)
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
    void listQueued(projectId).then(setItems)
  }, [projectId])

  useEffect(() => {
    refresh()
    return subscribeQueue(refresh)
  }, [refresh])

  return items
}

/**
 * Mount once near the app root. Flushes the queue at start-up (in case the phone was offline last
 * time) and again whenever the connection comes back or the app returns to the foreground, plus a
 * periodic retry, since a flaky site connection doesn't always report changes reliably.
 */
export function useAutoFlushOfflineQueue() {
  useEffect(() => {
    void flushQueue()

    let wasConnected = true
    const stopNet = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false && state.isInternetReachable !== false
      if (connected && !wasConnected) void flushQueue()
      wasConnected = connected
    })
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void flushQueue()
    })
    const interval = setInterval(() => void flushQueue(), 20_000)

    return () => {
      stopNet()
      appState.remove()
      clearInterval(interval)
    }
  }, [])
}
