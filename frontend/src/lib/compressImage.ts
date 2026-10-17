import { postForBlob } from './api'

// A phone camera photo is 5–7 MB; at this size a bill stays sharp enough to read
// every figure while weighing a few hundred KB — faster to send on site mobile
// data, and ~10x less storage and download per bill.
const MAX_EDGE_PX = 2000
const JPEG_QUALITY = 0.8

/**
 * Shrinks a photo before upload. A photo the browser can't open (a HEIC from the phone's gallery:
 * Chrome can't show those) is turned into a JPEG by the server. With no signal, or if that fails,
 * the original is returned and the server converts it when the bill arrives.
 */
export async function compressImage(file: File): Promise<File> {
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'bill'
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return (await jpegFromServer(file, baseName)) ?? file
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
    if (!blob || blob.size >= file.size) return file

    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  } finally {
    bitmap.close()
  }
}

async function jpegFromServer(file: File, baseName: string): Promise<File | null> {
  if (!navigator.onLine) return null
  try {
    const form = new FormData()
    form.append('photo', file)
    const jpeg = await postForBlob('/api/photos/jpeg', form)
    return new File([jpeg], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return null
  }
}
