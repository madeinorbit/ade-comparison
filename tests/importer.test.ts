import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareScreenshots } from '../scripts/import-screenshots.mjs'
import { validateMedia } from '../scripts/media.mjs'
test('screenshot import accepts covered reviewed bytes and preserves prior output on failure', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ade-comparison-media-test-'))
  try {
    const source = join(root, 'source'), output = join(root, 'media')
    mkdirSync(join(source, 'fixture'), { recursive: true })
    const bytes = readFileSync(new URL('../media/screenshots/conductor.webp', import.meta.url)), hash = createHash('sha256').update(bytes).digest('hex')
    writeFileSync(join(source, 'fixture/home.webp'), bytes)
    const record = { productId: 'fixture', path: 'screenshots/fixture/home.webp', sourcePage: 'https://example.com/', retrievedAt: '2026-11-07', provenance: 'first-party-marketing', visualStatus: 'accepted', bytes: bytes.length, sha256: hash, notes: 'private note must disappear', visualReview: { reviewer: 'private identity', sha256: hash } }
    const manifest = join(source, 'manifest.json')
    writeFileSync(manifest, JSON.stringify({ screenshots: [record, { ...record, productId: 'unknown-product' }, { ...record, productId: 'rejected', visualStatus: 'rejected' }] }))
    const result = await prepareScreenshots(source, output + '/', [{ id: 'fixture', researchStatus: 'covered' }])
    assert.equal(result.length, 1); assert.equal(result[0].width, 960); assert.equal(result[0].height, 600)
    const before = readFileSync(join(output, 'index.json'), 'utf8')
    assert.doesNotMatch(before, /reviewer|identity|notes|private note/)
    writeFileSync(manifest, JSON.stringify({ screenshots: [{ ...record, sha256: 'wrong' }] }))
    await assert.rejects(() => prepareScreenshots(source, output, [{ id: 'fixture', researchStatus: 'covered' }]), /digest mismatch/)
    assert.equal(readFileSync(join(output, 'index.json'), 'utf8'), before)
    writeFileSync(manifest, JSON.stringify({ screenshots: [{ ...record, path: '../escape.png' }] }))
    await assert.rejects(() => prepareScreenshots(source, output, [{ id: 'fixture', researchStatus: 'covered' }]), /escapes source/)
    assert.equal(readFileSync(join(output, 'index.json'), 'utf8'), before)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('register images and credential-free captures import while fallbacks and third-party images stay private', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ade-comparison-register-media-'))
  try {
    const source = join(root, 'source'), output = join(root, 'media')
    mkdirSync(join(source, 'fixture'), { recursive: true })
    const bytes = readFileSync(new URL('../media/screenshots/conductor.webp', import.meta.url))
    const hash = createHash('sha256').update(bytes).digest('hex')
    writeFileSync(join(source, 'fixture/home.webp'), bytes)
    const record = { productId: 'listed', path: 'screenshots/fixture/home.webp', sourcePage: 'https://example.com/docs', retrievedAt: '2026-11-07', provenance: 'first-party-docs', visualStatus: 'accepted', bytes: bytes.length, sha256: hash, visualReview: { sha256: hash } }
    const capture = { ...record, productId: 'captured', provenance: 'self-captured', assetUrl: null, capture: { version: '1.2.3', capturedAt: '2026-11-07', credentials: 'none', fixture: '/tmp/private-fixture', method: 'private setup detail' } }
    const manifest = join(source, 'manifest.json')
    writeFileSync(manifest, JSON.stringify({ screenshots: [record, capture, { ...record, productId: 'fallback', visualStatus: 'fallback' }, { ...record, productId: 'third-party', provenance: 'third-party-fallback' }] }))
    const identities = ['listed', 'captured', 'fallback', 'third-party'].map(id => ({ id, researchStatus: 'listed' }))
    const records = await prepareScreenshots(source, output, identities)
    assert.deepEqual(records.map(record => record.productId), ['captured', 'listed'], 'records are sorted by product ID')
    assert.deepEqual(records[0].capture, { version: '1.2.3', capturedAt: '2026-11-07' })
    assert.doesNotMatch(readFileSync(join(output, 'index.json'), 'utf8'), /private-fixture|private setup|credentials/)
    assert.equal(validateMedia(records, identities.map(product => product.id)), true)
    assert.throws(() => validateMedia([{ ...records[1], visualStatus: 'fallback' }], ['listed']), /provenance/)
    assert.throws(() => validateMedia([{ ...records[0], capture: { ...records[0].capture, fixture: 'private' } }], ['captured']), /self-capture/)
    writeFileSync(manifest, JSON.stringify({ screenshots: [{ ...capture, capture: { ...capture.capture, credentials: 'account' } }] }))
    await assert.rejects(() => prepareScreenshots(source, output, identities), /self-capture/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
