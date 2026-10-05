// Regenerates every app icon from the master artwork in brand/. Run from frontend/: `npm run icons`.
// The outputs are committed, so this only needs running after the artwork changes. The Android
// app picks up the new icons from the live site the next time `bubblewrap update` is run.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const icon = readFileSync(join(root, 'brand/icon.svg'))
const maskable = readFileSync(join(root, 'brand/icon-maskable.svg'))
const NAVY = '#1A3C5E'

// Render at 4x and scale down, so edges and the soft shadow stay smooth at every size.
const render = (svg, size) => sharp(svg, { density: 72 * 4 }).resize(size, size).png({ compressionLevel: 9 })

const outputs = [
  // Manifest "any" icons: the rounded tile. pwa-512 is also the Android app's splash image.
  [icon, 192, 'pwa-192.png'],
  [icon, 512, 'pwa-512.png'],
  // Android adaptive icon: full-bleed square, artwork inside the maskable safe zone (the launcher
  // crops it to its own shape).
  [maskable, 512, 'pwa-maskable-512.png'],
]
for (const [svg, size, name] of outputs) {
  await render(svg, size).toFile(join(pub, name))
  console.log(`public/${name}`)
}
// iPhone home-screen icon: iOS shows the whole square (no launcher crop), so zoom in to the
// centre 86% to give the document the same weight it has on Android.
const zoomed = await render(maskable, 1024).toBuffer()
await sharp(zoomed).extract({ left: 72, top: 72, width: 880, height: 880 }).resize(180, 180)
  .png({ compressionLevel: 9 }).toFile(join(pub, 'apple-touch-icon.png'))
console.log('public/apple-touch-icon.png')
copyFileSync(join(root, 'brand/icon.svg'), join(pub, 'favicon.svg'))
console.log('public/favicon.svg')

// iPhone home-screen app launch images: plain navy, so launching goes navy -> animated splash with
// no white flash. iOS only uses an image whose size matches the device exactly (portrait).
const IOS_SPLASH = [
  [440, 956, 3], [402, 874, 3], [420, 912, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2],
]
mkdirSync(join(pub, 'splash'), { recursive: true })
for (const [w, h, dpr] of IOS_SPLASH) {
  const name = `splash/ios-${w * dpr}x${h * dpr}.png`
  await sharp({ create: { width: w * dpr, height: h * dpr, channels: 3, background: NAVY } })
    .png({ palette: true, compressionLevel: 9 })
    .toFile(join(pub, name))
  console.log(`public/${name}`)
}
