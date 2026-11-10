import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
const keys = ['productId', 'path', 'sourcePage', 'retrievedAt', 'provenance', 'visualStatus', 'width', 'height']
export function validateMedia(records, registeredIds) {
  if (!Array.isArray(records)) throw new Error('Expected a public media array')
  const seen = new Set()
  for (const record of records) {
    const allowedKeys = record.provenance === 'self-captured' ? [...keys, 'capture'] : keys
    if (Object.keys(record).length !== allowedKeys.length || Object.keys(record).some(key => !allowedKeys.includes(key))) throw new Error('Unexpected public media field')
    if (!registeredIds.includes(record.productId) || seen.has(record.productId)) throw new Error('Media must identify one registered product')
    seen.add(record.productId)
    if (!/^screenshots\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(record.path)) throw new Error('Unsafe media path')
    const url = new URL(record.sourcePage)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe media source URL')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.retrievedAt) || !['first-party-marketing', 'first-party-repository', 'first-party-docs', 'first-party-release', 'self-captured'].includes(record.provenance) || record.visualStatus !== 'accepted') throw new Error('Invalid screenshot provenance')
    if (record.provenance === 'self-captured' && (!record.capture || Object.keys(record.capture).length !== 2 || typeof record.capture.version !== 'string' || !record.capture.version.trim() || record.capture.capturedAt !== record.retrievedAt)) throw new Error('Invalid self-capture provenance')
    if (![record.width, record.height].every(n => Number.isInteger(n) && n > 0)) throw new Error('Screenshot dimensions required')
  }
  return true
}
export function readMedia() {
  const media = new URL('../media/', import.meta.url), index = new URL('index.json', media)
  if (!existsSync(index)) return []
  const registered = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url))).products.map(p => p.id)
  const records = JSON.parse(readFileSync(index))
  validateMedia(records, registered)
  for (const record of records) {
    const path = resolve(fileURLToPath(media), record.path)
    if (!path.startsWith(resolve(fileURLToPath(media)) + sep) || !lstatSync(path).isFile()) throw new Error('Missing image or symlink in media bundle')
  }
  return records
}
