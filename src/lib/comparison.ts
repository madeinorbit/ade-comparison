// Rows and cell values for the Compare and Matrix tables. The table component and the
// per-product column files both read these, so a column fetched later matches a rendered one.
import { answerLabel, cellFor, facets, receiptHref, requirements, sunsetIds } from './data'
import { shotFor, shortLabel } from './sheet'
import type { Product, Requirement } from './types'
import { benchCell, benchTests, ordinal } from './benchmarks'

// Rows grouped the way the Finder groups its words. A single-choice facet (licence, price) is one row, not one per option.
const sections: [string, string[]][] = [
  ['Where you work', ['desktop-os', 'web-client', 'phone-client', 'cli']],
  ['Agents', ['agents', 'byo-subscription']],
  ['Where it runs', ['execution', 'laptop-independent']],
  ['How it works', ['isolation', 'parallel-runs', 'coordinator', 'issue-tracking', 'unattended-triggers']],
  ['Team and shipping', ['multiplayer', 'roles', 'sso', 'pr-workflow', 'review-ui']],
  ['Ownership', ['license', 'self-hosting', 'telemetry-opt-out']],
  ['Price', ['free-tier', 'pricing-model', 'paid-from']],
  ['Status', ['lifecycle-status']],
]
// Starting price folds a free tier into the first paid bracket; Free to use and Paid plans from show both parts.
const placed = new Set([...sections.flatMap(([, f]) => f), 'starting-price'])
const extra = facets.map(f => f.id).filter(id => !placed.has(id))
if (extra.length) sections.splice(-1, 0, ['More', extra])
export interface Row { key: string; label: string; keys: string[]; reqs: Requirement[]; single: boolean; list?: boolean }
// Multi-option facets read best as one line of what applies, e.g. how an ADE charges.
const listed = new Set(['pricing-model'])
const rowsFor = (facetIds: string[]): Row[] => facetIds.flatMap((id): Row[] => {
  const facet = facets.find(f => f.id === id)
  if (!facet) return []
  const reqs = requirements.filter(r => r.facetId === id && !r.anyOf)
  if (listed.has(id)) return [{ key: id, label: facet.label, keys: reqs.map(r => r.key), reqs, single: false, list: true }]
  if (facet.type === 'enum' && !facet.multiple) return [{ key: id, label: facet.label, keys: [...reqs.map(r => r.key), ...requirements.filter(r => r.facetId === id && r.anyOf).map(r => r.key)], reqs, single: true }]
  return reqs.map(r => ({ key: r.key, label: shortLabel(r.key), keys: [r.key, ...requirements.filter(a => a.anyOf?.includes(r.key)).map(a => a.key)], reqs: [r], single: false }))
})
export const grouped = sections.map(([title, ids]) => ({ title, rows: rowsFor(ids) })).filter(g => g.rows.length)
// One value per cell: the typed answer, its receipt, and how to show it.
export function value(p: Product, row: Row) {
  if (row.list) {
    const yes = row.reqs.filter(r => cellFor(p, r).value === 'yes')
    const req = yes[0] || row.reqs[0], cell = cellFor(p, req)
    const text = yes.map(r => shortLabel(r.key)).join(', ')
    return { raw: yes.map(r => r.option).join(' ') || 'unknown', text: text ? text[0].toUpperCase() + text.slice(1).toLowerCase() : 'Not listed', kind: yes.length ? 'v' : 'u', cell, req }
  }
  if (row.single) {
    const cell = cellFor(p, row.reqs[0])
    const option = facets.find(f => f.id === row.key)?.options?.find(o => o.id === cell.value)
    const req = row.reqs.find(r => r.option === cell.value) || row.reqs[0]
    return { raw: cell.value, text: option?.label || (cell.value === 'unknown' ? 'Not listed' : cell.value), kind: cell.value === 'unknown' ? 'u' : 'v', cell, req }
  }
  const req = row.reqs[0], cell = cellFor(p, req), label = answerLabel(p, req)
  return { raw: cell.value, text: label === 'Unknown' ? 'Not listed' : label, kind: cell.value === 'yes' ? 'y' : cell.value === 'no' ? 'n' : 'u', cell, req }
}
// ADEMark rows: one per headline test, keyed so the Compare script treats them like any other row.
export const benchRows = benchTests.map(test => ({ key: `ademark:${test.id}`, label: test.label, test }))

export function benchValue(p: Product, row: (typeof benchRows)[number]) {
  const c = benchCell(p.id, row.test)
  return { raw: c.kind === 'none' ? 'unknown' : c.text, text: c.text, place: c.rank ? `${ordinal(c.rank)} of ${c.of}` : '', kind: c.kind === 'value' ? 'v' : 'u', href: '' }
}
// What the Compare view needs to add a column in the browser: the heading, the screenshot and one cell per row.
export interface CompareColumn { id: string; name: string; closing: boolean; shot: { src: string; width: number; height: number } | null; cells: Record<string, [raw: string, text: string, kind: string, href: string]> }
export function compareColumn(p: Product): CompareColumn {
  const shot = shotFor(p.id)
  return {
    id: p.id, name: p.name, closing: sunsetIds.includes(p.id),
    shot: shot ? { src: `/media/${shot.path}`, width: shot.width, height: shot.height } : null,
    cells: Object.fromEntries([...grouped.flatMap(g => g.rows).map(row => { const v = value(p, row); return [row.key, [v.raw, v.text, v.kind, receiptHref(p.id, v.req.key)]] }),
      ...benchRows.map(row => { const v = benchValue(p, row); return [row.key, [v.raw, v.place ? `${v.text} · ${v.place}` : v.text, v.kind, v.href]] })]),
  }
}
