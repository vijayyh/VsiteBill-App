// Generates the native app's icons and splash image from the same master artwork as the website
// (frontend/brand/*.svg), so both apps carry an identical logo. Run from native-app/: `npm run assets`
// (needs `npm install` done in frontend/, whose sharp image library this uses).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, '../frontend/brand')
const sharp = createRequire(join(root, '../frontend/package.json'))('sharp')
const out = (name) => join(root, 'assets', name)

const icon = readFileSync(join(brand, 'icon.svg'))
const maskable = readFileSync(join(brand, 'icon-maskable.svg'))
const render = (svg, size) => sharp(svg, { density: 72 * 8 }).resize(size, size).png()

// App icon (iOS, and Expo's default): full-bleed square zoomed to the centre 86%, like the
// website's iPhone home-screen icon (iOS rounds the corners itself).
const big = await render(maskable, 2048).toBuffer()
await sharp(big).extract({ left: 144, top: 144, width: 1760, height: 1760 }).resize(1024, 1024).png().toFile(out('icon.png'))

// Android adaptive icon foreground (background colour is navy in app.config.ts). The artwork is
// drawn at 91/108 of the layer, exactly as the current Android app draws its launcher icon, so the
// new app's icon looks the same on the home screen.
const fg = await render(maskable, 862).toBuffer()
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fg, left: 81, top: 81 }])
  .png()
  .toFile(out('android-icon-foreground.png'))

// Android 13+ themed (monochrome) icon: just the document and check, as a white silhouette.
const mono = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(0.62) translate(0 -4)">
    <path fill="#fff" fill-rule="evenodd" d="M-102 -112 A24 24 0 0 1 -78 -136 H40 L102 -74 V112 A24 24 0 0 1 78 136 H-78 A24 24 0 0 1 -102 112 Z
      M-56 14 L-16 54 L60 -26" />
    <path d="M-56 14 L-16 54 L60 -26" fill="none" stroke="#000" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
  </g></svg>`)
const monoPng = await sharp(mono, { density: 72 * 4 }).resize(1024, 1024).png().toBuffer()
// Punch the check out of the white document (black stroke -> transparent).
const { data, info } = await sharp(monoPng).raw().toBuffer({ resolveWithObject: true })
for (let i = 0; i < data.length; i += 4) {
  if (data[i] < 128 && data[i + 3] > 0) data[i + 3] = 0
}
await sharp(data, { raw: info }).png().toFile(out('android-icon-monochrome.png'))

// Splash image: the rounded tile (identical to the website's splash first frame and pwa-512.png).
await render(icon, 1024).toFile(out('splash-icon.png'))

// Layers of the animated opening (src/components/SplashIntro.tsx), cut from the same artwork so the
// first frame is pixel-identical to the native splash image above: the glowing tile on its own, and
// the document (with its fold, header line and shadow) without the tile or the check, which is
// drawn and animated separately.
const svgText = icon.toString()
const tileOnly = svgText.replace(/<g transform="translate\(256 252\)">[\s\S]*<\/g>/, '')
const docOnly = svgText
  .replace(/<rect width="512" height="512" rx="114" fill="url\(#sv-glow\)"\/>/, '')
  .replace(/<path d="M-56 14 L-16 54 L60 -26"[\s\S]*?\/>/, '')
if (tileOnly === svgText || docOnly === svgText) throw new Error('brand/icon.svg changed shape: update the splash layer cut-outs')
await render(Buffer.from(tileOnly), 1024).toFile(out('splash-tile.png'))
await render(Buffer.from(docOnly), 1024).toFile(out('splash-doc.png'))

console.log('assets written: icon.png, android-icon-foreground.png, android-icon-monochrome.png, splash-icon.png, splash-tile.png, splash-doc.png')
