import indexData from '../../data/index.json'
import facetData from '../../data/facets.json'
import noticeData from '../../data/lifecycle-notices.json'
import statusData from '../../data/status-log.json'
import methodData from '../../data/methodology.json'
import type { Cell, Facet, Index, LifecycleNotice, Product, Requirement, Screenshot, StatusEvent } from './types.ts'
import { requirementsFrom } from './filter.ts'
import { pairCutoff } from './pairs.ts'
import { siteConfig } from '../../config.mjs'
const productFiles = import.meta.glob<Product>('../../data/products/*.json', { eager: true, import: 'default' })
export const index = indexData as Index
export const facets = facetData.facets as Facet[]
export const requirements = requirementsFrom(facets)
export const products = index.products.map(p => productFiles[`../../data/products/${p.id}.json`])
export const productById = new Map(products.map(p => [p.id, p]))
export const notices = noticeData as LifecycleNotice[]
export const statusLog = statusData as StatusEvent[]
export const methodology = methodData as {
  rubricVersion: string; publisher: { name: string; url: string; disclosure: string; editorialControl: string }
  unknownMeans: string; verification: Record<string, string>; freshnessDays: Record<string, number>
  freshnessRule: string; evidenceText: string; correctionRule: string; limitations: string[]
}
// Optional public media bundle. This is populated by the manifest importer, never by page code.
export const screenshots = Object.values(import.meta.glob<Screenshot[]>('../../media/index.json', { eager: true, import: 'default' }))[0] || []
export const sunsetIds = notices.filter(n => n.status === 'sunset').map(n => n.productId)
export const unknownCell: Cell = { value: 'unknown', verificationStatus: 'unknown', claimId: null, evidenceIds: [], checkedAt: null, crossCheckedAt: null, nextCheckAt: null }
export function cellFor(product: Product, req: Requirement): Cell {
  if (req.facetId === 'lifecycle-status') return notices.find(n => n.productId === product.id)?.facet || unknownCell
  const facet = facets.find(f => f.id === req.facetId)!
  const value = product.facets?.[facet.id]
  if (req.anyOf && facet.multiple) {
    const cells = req.anyOf.map(key => (value as Record<string, Cell> | undefined)?.[key.split(':')[1]] || unknownCell)
    return cells.find(c => c.value === 'yes') || (cells.every(c => c.value === 'no') ? cells[0] : unknownCell)
  }
  return (facet.multiple && req.option ? (value as Record<string, Cell>)?.[req.option] : value as Cell) || unknownCell
}
export const hasPage = (product: Product) => product.researchStatus === 'covered' || notices.some(n => n.productId === product.id)
export const facetAnchor = (key: string) => `receipt-${key.replace(/[^a-z0-9-]/g, '-')}`
export const claimAnchor = (claimId: string) => `finding-${claimId.replace(/[^a-z0-9-]/gi, '-')}`
export const receiptHref = (id: string, key: string) => `/ade/${id}/#${facetAnchor(key)}`
export function answerLabel(product: Product, req: Requirement): string {
  const cell = cellFor(product, req)
  if (cell.value === 'unknown') return 'Unknown'
  return typedAnswer(cell, req)
}
function typedAnswer(cell: Cell, req: Requirement): string {
  const facet = facets.find(f => f.id === req.facetId)!
  if (facet.type === 'tri-state' || facet.multiple) return cell.value === 'yes' ? 'Yes' : 'No'
  const label = facet.options?.find(o => o.id === cell.value)?.label || cell.value
  if (req.anyOf) return `${req.anyOf.includes(`${req.facetId}:${cell.value}`) ? 'Yes' : 'No'}. ${label}`
  return `${cell.value === req.option ? 'Yes' : 'No'}. ${label}`
}
// One entry per typed question: each multi-select option, or one single-select or tri-state facet.
const typedValues = (product: Product): Record<string, string> => Object.fromEntries(facets.filter(f => f.id !== 'lifecycle-status').flatMap(f => {
  const value = product.facets?.[f.id]
  return f.multiple ? (f.options || []).map(o => [`${f.id}:${o.id}`, (value as Record<string, Cell> | undefined)?.[o.id]?.value || 'unknown']) : [[f.id, (value as Cell | undefined)?.value || 'unknown']]
}).filter(([, value]) => value !== 'unknown'))
export const typedCount = (product: Product) => Object.keys(typedValues(product)).length
export function sharedTyped(a: Product, b: Product) {
  const left = typedValues(a), right = typedValues(b)
  const shared = Object.keys(left).filter(key => key in right)
  return { shared: shared.length, different: shared.filter(key => left[key] !== right[key]).length }
}
const researched = products.filter(p => p.researchStatus === 'covered')
const middle = [...researched.map(typedCount)].sort((a, b) => a - b)
// The same range and median for every covered product; no product is singled out.
export const typedCoverage = { min: middle[0] || 0, max: middle.at(-1) || 0, median: middle.length ? (middle.length % 2 ? middle[(middle.length - 1) / 2] : Math.round((middle[middle.length / 2 - 1] + middle[middle.length / 2]) / 2)) : 0 }
export const enoughEvidence = (product: Product) => product.researchStatus === 'covered' && (product.sourcedClaimCount || 0) >= siteConfig.minimumPairFindings && typedCount(product) > 0
export const pairProducts = products.filter(enoughEvidence)
// Twenty findings per side do not make a comparison. Most rows must not be one-sided or empty.
const candidatePairs = pairProducts.flatMap((a, i) => pairProducts.slice(i + 1).map(b => ({ slug: [a.id, b.id].sort().join('-vs-'), products: [a, b], ...sharedTyped(a, b) }))).filter(pair => pair.shared >= siteConfig.minimumPairSharedValues)
export const pairSharedCutoff = pairCutoff(candidatePairs.map(p => p.shared), siteConfig.maximumStaticPairs, siteConfig.minimumPairSharedValues)
export const pairs = candidatePairs.filter(pair => pair.shared >= pairSharedCutoff).sort((a, b) => b.shared - a.shared || a.slug.localeCompare(b.slug))
export const pairSlugs = new Set(pairs.map(p => p.slug))
export const clientPayload = {
  index: { ...index, products: [], bitsets: { ...index.bitsets, columns: Object.fromEntries(Object.entries(index.bitsets.columns).map(([key, value]) => [key, { yes: value.yes, no: value.no, crossChecked: '' }])) } },
  requirements: requirements.map(({ key, label, anyOf }) => ({ key, label, ...(anyOf ? { anyOf } : {}) })),
  sunsetIds,
}
export const jsonScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
// Counts for the footer and the Method page. Every number comes from the public package.
const covered = products.filter(p => p.researchStatus === 'covered')
const checkDates = covered.map(p => p.lastCheckedAt).filter((d): d is string => Boolean(d)).sort()
export const stats = {
  names: index.products.length,
  researched: covered.length,
  sources: covered.reduce((n, p) => n + (p.sources?.length || 0), 0),
  findings: covered.reduce((n, p) => n + (p.claims?.length || 0), 0),
  crossChecked: covered.reduce((n, p) => n + (p.claims || []).filter(c => c.verificationStatus === 'agent-cross-checked').length, 0),
  screenshots: screenshots.filter(s => covered.some(p => p.id === s.productId)).length,
  oldestCheck: checkDates[0] || index.generatedAt,
  newestCheck: checkDates.at(-1) || index.generatedAt,
}
export const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const formatCount = (n: number) => n.toLocaleString('en-GB')
