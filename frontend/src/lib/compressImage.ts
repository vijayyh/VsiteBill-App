import { postForBlob } from './api'

// A phone camera photo is 5–7 MB; at this size a bill stays sharp enough to read
// every figure while weighing a few hundred KB — faster to send on site mobile
// data, and ~10x less storage and download per bill.
const MAX_EDGE_PX = 2000
const JPEG_QUALITY = 0.8

// How long the server gets to turn a HEIC into a JPEG before the phone does it itself.
const SERVER_WAIT_MS = 20_000

/**
 * Shrinks a photo before upload. A HEIC from the phone's gallery (Chrome can't open those) is
 * turned into a JPEG by the server (quickest), or, with no signal or if the server fails or is
 * slow, decoded on the phone itself. If both fail, the original is returned and the server
 * converts it when the bill arrives.
 */
export async function compressImage(file: File): Promise<File> {
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'bill'
  let bitmap: ImageBitmap
  // A photo the browser can't show must become a JPEG even if that's bigger than the original.
  let viewable = true
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const fromServer = await jpegFromServer(file, baseName)
    if (fromServer) return fromServer
    const decoded = await decodeHeic(file)
    if (!decoded) return file
    bitmap = decoded
    viewable = false
  }

  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || (viewable && blob.size >= file.size)) return file

    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  } finally {
    bitmap.close()
  }
}

/** A HEIC decoded on the phone (the decoder, ~3 MB, is only loaded when one is needed). */
async function decodeHeic(file: File): Promise<ImageBitmap | null> {
  try {
    const { heicTo, isHeic } = await import('heic-to')
    if (!(await isHeic(file))) return null
    return await heicTo({ blob: file, type: 'bitmap' })
  } catch {
    return null
  }
}

async function jpegFromServer(file: File, baseName: string): Promise<File | null> {
  if (!navigator.onLine) return null
  try {
    const form = new FormData()
    form.append('photo', file)
    const jpeg = await postForBlob('/api/photos/jpeg', form, AbortSignal.timeout(SERVER_WAIT_MS))
    return new File([jpeg], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return null
  }
}
