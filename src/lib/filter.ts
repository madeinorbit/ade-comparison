import type { Facet, Identity, Index, Requirement } from './types.ts'
export type FilterRequirement = Pick<Requirement, 'key' | 'label' | 'anyOf'>
export type FinderSort = 'fit' | 'stars'
export interface FinderState { must: string[]; nice: string[]; query: string; preset: string | null; sort: FinderSort }
export interface Preset { id: string; label: string; must: string[]; nice: string[]; note?: string }
const localParallelNice = ['desktop-os:macos', 'agents:claude-code', 'agents:codex', 'byo-subscription', 'execution:local', 'isolation:worktree', 'pr-workflow', 'review-ui']
export const presets: Preset[] = [
  { id: 'away', label: 'Away from my desk', must: ['agents:claude-code', 'agents:codex', 'laptop-independent', 'any-phone-client'], nice: ['parallel-runs', 'review-ui', 'pr-workflow'] },
  { id: 'mac-claude-parallel', label: 'Parallel Claude Code on my Mac', must: ['desktop-os:macos', 'agents:claude-code', 'parallel-runs'], nice: ['isolation:worktree', 'review-ui', 'pr-workflow'] },
  { id: 'parallel-local', label: 'Parallel local agents', must: ['parallel-runs'], nice: localParallelNice, note: 'Parallel runs is required; the rest rank the list.' },
  { id: 'windows', label: 'Windows', must: ['desktop-os:windows'], nice: ['review-ui'] },
  { id: 'own-server', label: 'My own server', must: ['execution:own-server'], nice: ['laptop-independent', 'self-hosting'] },
  { id: 'laptop-closed', label: 'Laptop closed', must: ['laptop-independent'], nice: ['execution:own-server', 'execution:vendor-cloud'] },
  { id: 'phone', label: 'From my phone', must: ['any-phone-client'], nice: ['laptop-independent'] },
  { id: 'open-source', label: 'Open source', must: ['open-source-license'], nice: ['self-hosting'] },
  { id: 'team', label: 'Team with SSO and roles', must: ['sso', 'roles'], nice: ['multiplayer', 'issue-tracking'] },
]
export const emptyState = (): FinderState => ({ must: [], nice: [], query: '', preset: null, sort: 'fit' })
export function requirementsFrom(facets: Facet[]): Requirement[] {
  return [...facets.flatMap<Requirement>(f => f.type === 'tri-state'
    ? [{ key: f.id, label: f.label, facetId: f.id, option: null, description: f.description }]
    : (f.options || []).map(o => ({ key: `${f.id}:${o.id}`, label: `${f.label}: ${o.label}`, facetId: f.id, option: o.id, description: f.description }))),
    { key: 'open-source-license', label: 'Open-source license', facetId: 'license', option: null, description: 'An established Apache-2.0, MIT, GPL-3.0 or AGPL-3.0 main-application license, including the listed or-later variants.', anyOf: ['license:apache-2-0', 'license:mit', 'license:gpl-3-0', 'license:gpl-3-0-or-later', 'license:agpl-3-0', 'license:agpl-3-0-or-later'] },
    { key: 'any-desktop', label: 'Any desktop app', facetId: 'desktop-os', option: null, description: 'A desktop app for macOS, Windows or Linux. Any one of them confirms this requirement.', anyOf: ['desktop-os:macos', 'desktop-os:windows', 'desktop-os:linux'] },
    { key: 'paid-up-to-20', label: 'Paid plan up to $20/month', facetId: 'paid-from', option: null, description: 'The lowest public paid plan costs $20 a month or less at monthly billing. Either bracket confirms this requirement.', anyOf: ['paid-from:up-to-10-usd-month', 'paid-from:11-to-20-usd-month'] },
    { key: 'paid-up-to-40', label: 'Paid plan up to $40/month', facetId: 'paid-from', option: null, description: 'The lowest public paid plan costs $40 a month or less at monthly billing. Any of the three brackets confirms this requirement.', anyOf: ['paid-from:up-to-10-usd-month', 'paid-from:11-to-20-usd-month', 'paid-from:21-to-40-usd-month'] },
    { key: 'any-phone-client', label: 'Any phone client', facetId: 'phone-client', option: null, description: 'A native iPhone app, a native Android app or a phone browser client. Any one of them confirms this requirement.', anyOf: ['phone-client:ios', 'phone-client:android', 'phone-client:mobile-web'] }]
}
export function parseState(search: string, requirements: FilterRequirement[]): FinderState {
  const p = new URLSearchParams(search), valid = new Set(requirements.map(r => r.key))
  const preset = presets.find(x => x.id === p.get('use'))
  const clean = (key: string, fallback: string[]) => [...new Set((p.has(key) ? p.get(key)!.split(',') : fallback).filter(k => valid.has(k)))]
  const must = clean('must', preset?.must || [])
  return { must, nice: clean('nice', preset?.nice || []).filter(k => !must.includes(k)), query: (p.get('q') || '').slice(0, 200), preset: preset?.id || null, sort: p.get('sort') === 'stars' ? 'stars' : 'fit' }
}
export function serializeState(state: FinderState): string {
  const p = new URLSearchParams()
  if (state.preset) p.set('use', state.preset)
  // Explicit empty lists keep a modified preset from silently restoring defaults.
  if (state.must.length || state.preset) p.set('must', state.must.join(','))
  if (state.nice.length || state.preset) p.set('nice', state.nice.join(','))
  if (state.query) p.set('q', state.query)
  if (state.sort === 'stars') p.set('sort', 'stars')
  return p.toString()
}
export type Answer = 'yes' | 'no' | 'unknown'
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0))
const has = (bits: Uint8Array, row: number) => Boolean(bits[row >> 3] & (1 << (row & 7)))
const compareNames = new Intl.Collator('en').compare
export interface Result { product: Identity; index: number; group: 'fits' | 'kind-of' | 'shutting-down'; met: number; mustMet: number }
export function matchesProductQuery(product: Identity, query: string, sunset = false): boolean {
  return `${product.name} ${(product.formerNames || []).join(' ')} ${sunset ? 'shutting down sunset' : ''}`.toLowerCase().includes(query.toLowerCase())
}
// `stars` maps product IDs to a sourced GitHub star count. Missing means no public count, never zero.
export function createFilter(index: Index, requirements: FilterRequirement[], sunsetIds: string[] = [], stars: Record<string, number> = {}) {
  const columns = Object.fromEntries(Object.entries(index.bitsets.columns).map(([key, c]) => [key, { yes: decode(c.yes), no: decode(c.no) }]))
  const byKey = new Map(requirements.map(r => [r.key, r]))
  const closing = new Set(sunsetIds)
  const bitsFor = (key: string) => {
    const direct = columns[key]
    if (direct) return direct
    const alternatives = byKey.get(key)?.anyOf?.map(k => columns[k]).filter(Boolean) || []
    const yes = new Uint8Array(Math.ceil(index.products.length / 8)), no = new Uint8Array(yes.length)
    if (alternatives.length) for (let b = 0; b < yes.length; b++) {
      yes[b] = alternatives.reduce((v, a) => v | a.yes[b], 0)
      no[b] = alternatives.reduce((v, a) => v & a.no[b], 255)
    }
    return { yes, no }
  }
  const compiled = Object.fromEntries(requirements.map(r => [r.key, bitsFor(r.key)]))
  const answer = (row: number, key: string): Answer => {
    const c = compiled[key]
    return c && has(c.yes, row) ? 'yes' : c && has(c.no, row) ? 'no' : 'unknown'
  }
  return {
    answer,
    run(state: FinderState): Result[] {
      const must = state.must.filter(k => byKey.has(k)), nice = state.nice.filter(k => byKey.has(k) && !must.includes(k))
      const mustBits = must.map(key => compiled[key].yes), niceBits = nice.map(key => compiled[key].yes)
      const results: Result[] = []
      index.products.forEach((product, row) => {
        if (product.researchStatus !== 'covered') return
        if (state.query && !matchesProductQuery(product, state.query, closing.has(product.id))) return
        const mustMet = mustBits.reduce((count, bits) => count + Number(has(bits, row)), 0)
        const niceMet = niceBits.reduce((count, bits) => count + Number(has(bits, row)), 0)
        // Only confirmed matches count. Unknown never becomes a failed requirement.
        if (must.length && mustMet <= must.length / 2) return
        const group = closing.has(product.id) ? 'shutting-down' : mustMet === must.length ? 'fits' : 'kind-of'
        results.push({ product, index: row, group, met: mustMet + niceMet, mustMet })
      })
      // The stars order applies inside each group and after must-haves met, so it never lifts a weaker fit.
      // Products without a public count follow in the usual fit order.
      const starsOf = (r: Result) => stars[r.product.id] ?? -1
      return results.sort((a, b) => b.mustMet - a.mustMet || (state.sort === 'stars' ? starsOf(b) - starsOf(a) : 0) || b.met - a.met || compareNames(a.product.name, b.product.name) || compareNames(a.product.id, b.product.id))
    },
  }
}
export function parseProducts(search: string, products: Identity[]): string[] {
  const valid = new Set(products.map(p => p.id))
  return [...new Set((new URLSearchParams(search).get('products') || '').split(',').filter(id => valid.has(id)))].slice(0, 4)
}
export function promptFor(state: FinderState, requirements: FilterRequirement[], baseUrl: string): string {
  const query = serializeState(state)
  const names = (keys: string[]) => keys.map(k => requirements.find(r => r.key === k)?.label).filter(Boolean).join('; ') || 'None selected'
  return `Help me choose an agent development environment using adecomparison.com.\nMust have: ${names(state.must)}.\nNice to have: ${names(state.nice)}.\nFinder: ${new URL(query ? '/?' + query : '/', baseUrl).href}\nRead ${new URL('/llms.txt', baseUrl).href} and the per-product JSON or Markdown. Cite each finding with its public source, locator, checked date, plan and surface. Read the Method page for the evidence rules. Rank by must-haves met, then preferences, then name. Do not invent an overall score. Check source age and lifecycle dates before recommending a product.`
}
