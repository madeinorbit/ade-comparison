// Synthetic notices for an isolated build only. Never write this fixture into the real data package.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
export function installLifecycleFixture(directory) {
  const root = join(directory, 'data')
  const read = name => JSON.parse(readFileSync(join(root, name)))
  const write = (name, value) => writeFileSync(join(root, name), JSON.stringify(value))
  const index = read('index.json'), notices = read('lifecycle-notices.json')
  const targets = [index.products.find(p => p.id === 'capy'), index.products.find(p => p.id === 'jules')]
  const checkedAt = index.generatedAt
  const daysLater = n => new Date(Date.parse(checkedAt) + n * 86400000).toISOString().slice(0, 10)
  for (const product of targets) {
    const lifecycle = { status: 'sunset', note: 'Synthetic test fixture. Cloud service ends; the local app continues.', scope: 'Cloud service only', continuation: 'Local app continues.', announcementDate: checkedAt, serviceEndDate: daysLater(7), checkedAt, crossCheckedAt: checkedAt, nextCheckAt: daysLater(14), evidenceIds: [`${product.id}:synthetic-notice`] }
    const facet = { value: 'sunset', verificationStatus: 'agent-cross-checked', claimId: `${product.id}:lifecycle`, evidenceIds: lifecycle.evidenceIds, checkedAt, crossCheckedAt: checkedAt, nextCheckAt: daysLater(14) }
    const source = { id: lifecycle.evidenceIds[0], productId: product.id, kind: 'documented', url: 'https://example.com/synthetic-notice', title: 'Synthetic shutdown notice', locator: 'Service dates', sourceDate: checkedAt, retrievedAt: checkedAt, finding: lifecycle.note }
    const notice = { productId: product.id, ...lifecycle, facet, sources: [source] }
    const previous = notices.findIndex(n => n.productId === product.id)
    if (previous >= 0) notices[previous] = notice; else notices.push(notice)
    if (product.researchStatus === 'covered') {
      const record = read(`products/${product.id}.json`)
      record.lifecycle = lifecycle
      record.sources = [...record.sources.filter(s => s.id !== source.id), source]
      record.facets['lifecycle-status'] = facet
      write(`products/${product.id}.json`, record)
    }
    const row = index.products.findIndex(p => p.id === product.id)
    for (const [key, column] of Object.entries(index.bitsets.columns)) {
      if (!key.startsWith('lifecycle-status:')) continue
      for (const kind of ['yes', 'no', 'crossChecked']) {
        const bytes = Buffer.from(column[kind], 'base64'), bit = 1 << (row & 7)
        const positive = key === 'lifecycle-status:sunset'
        bytes[row >> 3] = kind === 'crossChecked' || (kind === 'yes' ? positive : !positive) ? bytes[row >> 3] | bit : bytes[row >> 3] & ~bit
        column[kind] = bytes.toString('base64')
      }
    }
  }
  write('index.json', index); write('lifecycle-notices.json', notices)
  return { productIds: targets.map(p => p.id), rows: Object.fromEntries(targets.map(p => [p.id, index.products.findIndex(row => row.id === p.id)])), serviceEndDate: daysLater(7) }
}
