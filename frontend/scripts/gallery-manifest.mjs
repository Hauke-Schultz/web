import { readdirSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync } from 'fs'
import { resolve, dirname, parse } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import sharp from 'sharp'

// Baut die Fotobox-Galerie auf:
//  1. scannt public/party/fotobox/ nach Originalbildern
//  2. erzeugt kleine WebP-Thumbnails (inkrementell) in fotobox/thumbs/
//  3. schreibt manifest.json  (Liste { src, thumb })
//  4. packt die Originale in ~30-MB-ZIP-Teile + zips.json
// Aufruf: npm run gallery   (nachdem die Fotos abgelegt wurden)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const partyDir = resolve(root, 'public/party')
const galleryDir = resolve(partyDir, 'fotobox')
const thumbsDir = resolve(galleryDir, 'thumbs')
const manifestPath = resolve(galleryDir, 'manifest.json')
const zipsManifestPath = resolve(galleryDir, 'zips.json')

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i
const THUMB_WIDTH = 400
const THUMB_QUALITY = 72
const NUM_ZIPS = 2 // Anzahl der ZIP-Teile

for (const dir of [galleryDir, thumbsDir]) {
  if (!existsSync(dir)) { mkdirSync(dir, { recursive: true }); console.log(`[gallery] Ordner angelegt: ${dir}`) }
}

const naturalSort = (a, b) => a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' })

const images = readdirSync(galleryDir).filter(f => IMAGE_RE.test(f)).sort(naturalSort)

// ── 1. Thumbnails (inkrementell) ──────────────────────────────
const manifest = []
let built = 0
for (const name of images) {
  const orig = resolve(galleryDir, name)
  const thumbName = `${parse(name).name}.webp`
  const thumbPath = resolve(thumbsDir, thumbName)

  const needs = !existsSync(thumbPath) || statSync(thumbPath).mtimeMs < statSync(orig).mtimeMs
  if (needs) {
    try {
      await sharp(orig).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY }).toFile(thumbPath)
      built++
    } catch (err) {
      console.warn(`[gallery] Thumbnail fehlgeschlagen für ${name}: ${err.message}`)
    }
  }
  manifest.push({ src: name, thumb: `thumbs/${thumbName}` })
}
console.log(`[gallery] ${images.length} Bild(er), ${built} Thumbnail(s) neu erzeugt`)

// Verwaiste Thumbnails entfernen (Original gelöscht)
const validThumbs = new Set(manifest.map(m => parse(m.src).name + '.webp'))
for (const t of readdirSync(thumbsDir).filter(f => f.endsWith('.webp'))) {
  if (!validThumbs.has(t)) rmSync(resolve(thumbsDir, t))
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`[gallery] manifest.json geschrieben`)

// Alte ZIP-Teile aufräumen
for (const f of readdirSync(partyDir).filter(f => /^fotobox-\d+\.zip$/.test(f))) {
  rmSync(resolve(partyDir, f))
}

if (images.length === 0) {
  writeFileSync(zipsManifestPath, JSON.stringify([], null, 2) + '\n')
  console.log('[gallery] Keine Bilder – ZIP-Teile übersprungen.')
  process.exit(0)
}

// ── 2. In NUM_ZIPS gleich große Teile chunken ─────────────────
const per = Math.ceil(images.length / NUM_ZIPS)
const chunks = []
for (let i = 0; i < images.length; i += per) chunks.push(images.slice(i, i + per))

// ── 3. ZIP-Teile via PowerShell Compress-Archive ──────────────
const zips = []
try {
  chunks.forEach((files, i) => {
    const zipName = `fotobox-${i + 1}.zip`
    const zipPath = resolve(partyDir, zipName)
    const list = files.map(f => `'${resolve(galleryDir, f).replace(/'/g, "''")}'`).join(',')
    const ps = `Compress-Archive -Path ${list} -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
    execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' })
    zips.push({ name: zipName, count: files.length, bytes: statSync(zipPath).size })
    console.log(`[gallery] ${zipName} → ${files.length} Fotos, ${(statSync(zipPath).size / 1048576).toFixed(1)} MB`)
  })
  writeFileSync(zipsManifestPath, JSON.stringify(zips, null, 2) + '\n')
  console.log(`[gallery] zips.json geschrieben → ${zips.length} Teil(e)`)
} catch (err) {
  writeFileSync(zipsManifestPath, JSON.stringify([], null, 2) + '\n')
  console.warn('[gallery] ZIP-Erstellung fehlgeschlagen (zips.json geleert):', err.message)
}
