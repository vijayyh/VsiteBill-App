import { File } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

// Same rule as the web app (frontend/src/lib/compressImage.ts): a phone camera photo is 5–7 MB; at
// this size a bill stays sharp enough to read every figure while weighing a few hundred KB.
const MAX_EDGE_PX = 2000
const JPEG_QUALITY = 0.8

export interface Photo {
  uri: string
  width: number
  height: number
  fileName?: string | null
}

/** Shrinks a photo before it's sent or queued. Returns the original if it can't be processed. */
export async function compressImage(photo: Photo): Promise<{ uri: string; filename: string }> {
  const baseName = (photo.fileName ?? 'bill').replace(/\.[^.]+$/, '') || 'bill'
  const original = { uri: photo.uri, filename: photo.fileName ?? 'bill.jpg' }
  try {
    const longest = Math.max(photo.width, photo.height)
    const scale = longest > 0 ? Math.min(1, MAX_EDGE_PX / longest) : 1
    const context = ImageManipulator.manipulate(photo.uri)
    if (scale < 1) context.resize({ width: Math.round(photo.width * scale), height: Math.round(photo.height * scale) })
    const rendered = await context.renderAsync()
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY })

    const before = new File(photo.uri).size
    const after = new File(saved.uri).size
    if (before && after && after >= before) return original
    return { uri: saved.uri, filename: `${baseName}.jpg` }
  } catch {
    return original
  }
}
