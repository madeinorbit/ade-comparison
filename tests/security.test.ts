import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import type { Product } from '../src/lib/types.ts'
import { validatePackage, loadPackage } from '../scripts/validate-data.mjs'
import { validateMedia } from '../scripts/media.mjs'
const data = loadPackage()
test('committed public package has exact public shapes and matching bits', () => { assert.equal(validatePackage(data, data.index.generatedAt), true) })
test('private fields fail before a build can serialize them', () => {
  for (const field of ['researcher', 'reviewer', 'rationale', 'contentHash', 'privateNote']) {
    const copy = structuredClone(data); (copy.products.find((p: Product) => p.researchStatus === 'covered') as any)[field] = 'private'
    assert.throws(() => validatePackage(copy, data.index.generatedAt), /Unexpected public field/)
  }
  const copy = structuredClone(data); (copy.products.find((p: Product) => p.researchStatus === 'not-researched') as any).claims = []
  assert.throws(() => validatePackage(copy, data.index.generatedAt), /Unexpected public field/)
})
test('overdue receipts stay valid without changing their checked dates', () => {
  const original = JSON.stringify(data)
  assert.equal(validatePackage(data, '2099-01-01'), true)
  assert.equal(JSON.stringify(data), original)
})
test('future and malformed check dates still fail the standalone build', () => {
  assert.throws(() => validatePackage(data, '2026-01-01'), /future package date/)
  for (const checkedAt of ['2099-01-01', '2026-02-30', '2026']) {
    const copy = structuredClone(data)
    copy.products.find((p: Product) => p.claims?.length).claims[0].checkedAt = checkedAt
    assert.throws(() => validatePackage(copy, data.index.generatedAt), /Invalid or future check date/)
  }
})
test('unknown cannot acquire bits or pretend to have a source', () => {
  const copy = structuredClone(data)
  const listingRow = copy.products.findIndex((p: Product) => p.researchStatus === 'not-researched')
  const c = copy.index.bitsets.columns[Object.keys(copy.index.bitsets.columns)[0]]
  const bytes = Buffer.from(c.no, 'base64'); bytes[listingRow >> 3] |= 1 << (listingRow & 7); c.no = bytes.toString('base64')
  assert.throws(() => validatePackage(copy, data.index.generatedAt), /Bitset differs/)
})
test('a cross-check label cannot outrun its evidence', () => {
  const covered = (copy: any) => copy.products.find((p: Product) => (p.claims?.length || 0) > 0 && Object.values(p.facets || {}).some((c: any) => c.value === 'yes' && c.claimId))
  const noDate = structuredClone(data), finding = covered(noDate).claims[0]
  finding.verificationStatus = 'agent-cross-checked'; finding.crossCheckedAt = null
  assert.throws(() => validatePackage(noDate, data.index.generatedAt), /Verification label/)
  const onSourced = structuredClone(data)
  // Pick a product with a yes value backed by a cross-checked finding; newly researched products have none yet.
  const product = onSourced.products.find((p: Product) => Object.values(p.facets || {}).some((c: any) => c.value === 'yes' && c.claimId &&
    (p.claims || []).some((claim: any) => claim.claimId === c.claimId && claim.verificationStatus === 'agent-cross-checked')))
  // Launch mappings await a separate review. Create a cross-check fixture rather
  // than requiring the shipped package to contain an accepted mapping already.
  const [facetId, cell]: any = Object.entries(product.facets).find(([, c]: any) => c.value === 'yes' && c.claimId && product.claims.some((claim: any) => claim.claimId === c.claimId && claim.verificationStatus === 'agent-cross-checked'))!
  cell.verificationStatus = 'agent-cross-checked'; cell.crossCheckedAt = data.index.generatedAt
  const row = onSourced.products.findIndex((p: Product) => p.id === product.id)
  const bits = Buffer.from(onSourced.index.bitsets.columns[facetId].crossChecked, 'base64')
  bits[row >> 3] |= 1 << (row & 7); onSourced.index.bitsets.columns[facetId].crossChecked = bits.toString('base64')
  const claim = product.claims.find((c: any) => c.claimId === cell.claimId)
  claim.verificationStatus = 'sourced'; claim.crossCheckedAt = null
  assert.throws(() => validatePackage(onSourced, data.index.generatedAt), /Cross-checked filter on an unchecked finding/)
})
test('former-name search identity must resolve to a public rename finding', () => {
  const copy = structuredClone(data)
  const product = copy.products.find((p: Product) => p.id === 'superset')
  const identity = copy.index.products.find((p: Product) => p.id === 'superset')
  assert.deepEqual(product.formerNames, ['Superset'])
  product.formerNames = identity.formerNames = ['Unrelated product']
  assert.throws(() => validatePackage(copy, data.index.generatedAt), /no rename finding/)
})
test('status events and lifecycle states must trace to the package', () => {
  const event = structuredClone(data); event.status[0].claimIds.push('nonexistent:claim')
  assert.throws(() => validatePackage(event, data.index.generatedAt), /Status event without a current receipt/)
  const lifecycle = structuredClone(data); lifecycle.products.find((p: Product) => p.id === 'cursor').lifecycle = lifecycle.products.find((p: Product) => p.id === 'conductor').lifecycle
  assert.throws(() => validatePackage(lifecycle, data.index.generatedAt), /Lifecycle status differs/)
})
test('media exports have only the approved fields and registered products', () => {
  const records = JSON.parse(readFileSync(new URL('../media/index.json', import.meta.url), 'utf8'))
  const ids = data.products.map((p: Product) => p.id)
  assert.equal(validateMedia(records, ids), true)
  const contaminated = structuredClone(records); contaminated[0].reviewer = 'private'
  assert.throws(() => validateMedia(contaminated, ids), /Unexpected public media field/)
  assert.throws(() => validateMedia([{ ...records[0], productId: 'not-registered' }], ids), /registered product/)
  assert.throws(() => validateMedia([{ ...records[0], path: '../private.png' }], ids), /Unsafe media path/)
})
test('production code and package have no private workspace imports, and analytics is GTM only', () => {
  const walk = (url: URL): string[] => readdirSync(url, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(new URL(e.name + '/', url)) : [readFileSync(new URL(e.name, url), 'utf8')])
  const source = walk(new URL('../src/', import.meta.url)).join('\n')
  assert.doesNotMatch(source, /from\s+['"][^'"]*(?:catalog\/|@podium|packages\/)/)
  assert.doesNotMatch(source, /(?:plausible|posthog|segment\.com)/i)
  // Google Tag Manager is the one analytics script, loaded after page load on the production host only.
  assert.equal(source.match(/googletagmanager\.com\/gtm\.js/g)?.length, 1)
  assert.match(source, /location\.hostname\s*===\s*'adecomparison\.com'/)
  assert.doesNotMatch(readFileSync(new URL('../package.json', import.meta.url), 'utf8'), /workspace:/)
})
test('a reviewed lifecycle-only notice can survive without adding claims to a plain listing', () => {
  const copy = structuredClone(data)
  const checkedAt = '2026-11-07'
  const product = copy.products.find((p: Product) => p.researchStatus === 'not-researched')
  const row = copy.products.findIndex((p: Product) => p.id === product.id)
  const evidenceId = `${product.id}:public-shutdown`, claimId = `${product.id}:lifecycle`
  const source = { id: evidenceId, productId: product.id, kind: 'documented', url: 'https://example.com/shutdown', title: 'Synthetic public notice', locator: 'Shutdown dates', sourceDate: checkedAt, retrievedAt: checkedAt, finding: 'Synthetic fixture. Service ends on the stated date.' }
  copy.notices.push({ productId: product.id, status: 'sunset', note: 'Synthetic fixture only.', scope: 'Cloud service', continuation: 'Local app continues.', announcementDate: checkedAt, serviceEndDate: '2026-11-20', checkedAt, crossCheckedAt: checkedAt, nextCheckAt: '2026-11-21', evidenceIds: [evidenceId], sources: [source], facet: { value: 'sunset', verificationStatus: 'agent-cross-checked', claimId, evidenceIds: [evidenceId], checkedAt, crossCheckedAt: checkedAt, nextCheckAt: '2026-11-21' } })
  for (const [key, column] of Object.entries(copy.index.bitsets.columns) as [string, { yes: string; no: string; crossChecked: string }][]) {
    if (!key.startsWith('lifecycle-status:')) continue
    const yes = key === 'lifecycle-status:sunset'
    for (const kind of ['yes', 'no', 'crossChecked'] as const) {
      const bytes = Buffer.from(column[kind], 'base64')
      if (kind === 'crossChecked' || (kind === 'yes' ? yes : !yes)) bytes[row >> 3] |= 1 << (row & 7)
      column[kind] = bytes.toString('base64')
    }
  }
  assert.equal(validatePackage(copy, copy.index.generatedAt), true)
  assert.deepEqual(Object.keys(product).sort(), ['id', 'name', 'researchStatus', 'website'])
})
