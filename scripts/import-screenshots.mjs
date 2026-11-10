// Explicit private-repo preparation only. The portable site build never invokes this importer.
import { createHash } from 'node:crypto'
import { readFileSync, mkdirSync, renameSync, rmSync, writeFileSync, realpathSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { validateMedia } from './media.mjs'
export async function prepareScreenshots(sourceDirectory, outputDirectory, identities) {
  const source = realpathSync(sourceDirectory)
  outputDirectory = resolve(outputDirectory)
  const manifest = JSON.parse(readFileSync(resolve(source, 'manifest.json')))
  const registered = identities.map(p => p.id)
  const stage = `${outputDirectory}.preparing`
  rmSync(stage, { recursive: true, force: true }); mkdirSync(resolve(stage, 'screenshots'), { recursive: true })
  const records = []
  try {
    for (const entry of manifest.screenshots) {
      // A catalog fallback documents a search gap; it is not accepted public coverage.
      if (!registered.includes(entry.productId) || entry.visualStatus !== 'accepted') continue
      if (!['first-party-marketing', 'first-party-repository', 'first-party-docs', 'first-party-release', 'self-captured'].includes(entry.provenance)) continue
      if (entry.visualReview?.sha256 !== entry.sha256) throw new Error(`Screenshot review digest mismatch: ${entry.productId}`)
      const path = resolve(source, entry.path.replace(/^screenshots\//, ''))
      if (!path.startsWith(source + sep) || !realpathSync(path).startsWith(source + sep)) throw new Error('Screenshot path escapes source directory')
      const bytes = readFileSync(path)
      if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Screenshot bytes differ from manifest: ${entry.productId}`)
      // Still, bounded previews avoid animated marketing GIFs and reserve a stable box.
      const outputPath = `screenshots/${entry.productId}.webp`
      const info = await sharp(bytes, { animated: false }).rotate().resize({ width: 960, height: 600, fit: 'contain', background: '#ffffff' }).webp({ quality: 78 }).toFile(resolve(stage, outputPath))
      /** @type {import('../src/lib/types').Screenshot} */
      const record = { productId: entry.productId, path: outputPath, sourcePage: entry.sourcePage, retrievedAt: entry.retrievedAt, provenance: entry.provenance, visualStatus: entry.visualStatus, width: info.width, height: info.height }
      if (entry.provenance === 'self-captured') {
        if (entry.assetUrl !== null || entry.capture?.credentials !== 'none' || entry.capture.capturedAt !== entry.retrievedAt) throw new Error(`Invalid self-capture provenance: ${entry.productId}`)
        record.capture = { version: entry.capture.version, capturedAt: entry.capture.capturedAt }
      }
      records.push(record)
    }
    validateMedia(records, registered)
    writeFileSync(resolve(stage, 'index.json'), JSON.stringify(records, null, 2) + '\n')
    rmSync(outputDirectory, { recursive: true, force: true }); renameSync(stage, outputDirectory)
    return records
  } catch (error) { rmSync(stage, { recursive: true, force: true }); throw error }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = process.argv[process.argv.indexOf('--source') + 1]
  if (!process.argv.includes('--source') || !source) throw new Error('Usage: npm run screenshots:import -- --source <catalog screenshot directory>')
  const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url)))
  const records = await prepareScreenshots(source, fileURLToPath(new URL('../media/', import.meta.url)), index.products)
  console.log(`Prepared ${records.length} reviewed screenshot previews with public provenance.`)
}
