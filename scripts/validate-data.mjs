// Standalone public schema guard. No catalog or workspace imports are permitted here.
import { readFileSync, readdirSync, lstatSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = new URL('../data/', import.meta.url)
const object = fields => ({ fields }), array = item => ({ array: item }), optional = item => ({ optional: item }), nullable = item => ({ nullable: item })
const text = value => typeof value === 'string', number = value => typeof value === 'number' && Number.isFinite(value)
const choice = (...values) => value => values.includes(value)
const strings = array(text), maybeText = nullable(text)
function hasFormerNameFinding(product, finding, name, surface = product.name) {
  if (typeof surface !== 'string' || !surface.startsWith(product.name)) return false
  return [',', ' (', ' '].some(next => finding.answer.includes(`${surface}, formerly ${name}${next}`))
}
const url = value => {
  if (!text(value)) return false
  try { const parsed = new URL(value); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[?::1\]?)/.test(parsed.hostname) && !parsed.hostname.endsWith('.internal') && !/\/api\/files\//.test(parsed.pathname) } catch { return false }
}
const identity = { id: value => text(value) && /^[a-z0-9][a-z0-9-]*$/.test(value), name: text, website: nullable(url), researchStatus: choice('covered', 'not-researched') }
const searchIdentity = { ...identity, formerNames: optional(strings) }
const source = object({ id: text, productId: text, kind: text, url, title: text, locator: text, sourceDate: maybeText, retrievedAt: text, finding: text, commit: optional(text), path: optional(text), method: optional(text), configuration: optional(text), fixture: optional(text), result: optional(text) })
const lifecycleFields = { status: choice('sunset'), note: text, scope: text, continuation: maybeText, announcementDate: maybeText, serviceEndDate: maybeText, checkedAt: text, crossCheckedAt: maybeText, nextCheckAt: text, evidenceIds: strings }
const lifecycle = (value, path) => assertShape(value, value?.status === 'unknown' ? object({ status: choice('unknown'), note: choice(null) }) : object(lifecycleFields), path)
const receipt = values => object({ value: choice('unknown', ...values), verificationStatus: choice('unknown', 'sourced', 'agent-cross-checked'), claimId: maybeText, evidenceIds: strings, checkedAt: maybeText, crossCheckedAt: maybeText, nextCheckAt: maybeText })
const claim = object({ productId: text, claimId: text, verificationStatus: choice('sourced', 'agent-cross-checked'), support: text, answer: text, availability: text, delivery: text,
  scope: object({ surfaceIds: strings, version: maybeText, plan: maybeText, os: strings, executionModes: strings, region: maybeText, harness: maybeText, surfaces: array(object({ id: text, name: text, type: text })) }),
  questions: array(object({ id: text, question: text, support: text, answer: text, evidenceIds: strings })), limitations: strings, checkedAt: text, crossCheckedAt: maybeText, nextCheckAt: text, evidenceIds: strings })
export function assertShape(value, schema, path = '$') {
  if (typeof schema === 'function') { if (schema(value, path) === false) throw new Error(`Invalid public value at ${path}`); return }
  if (schema.optional) { if (value !== undefined) assertShape(value, schema.optional, path); return }
  if (schema.nullable) { if (value !== null) assertShape(value, schema.nullable, path); return }
  if (schema.array) {
    if (!Array.isArray(value)) throw new Error(`Expected public array at ${path}`)
    value.forEach((v, i) => assertShape(v, schema.array, `${path}[${i}]`)); return
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected public object at ${path}`)
  for (const key of Object.keys(value)) if (!(key in schema.fields)) throw new Error(`Unexpected public field at ${path}.${key}`)
  for (const [key, rule] of Object.entries(schema.fields)) assertShape(value[key], rule, `${path}.${key}`)
}
// A cross-check label needs its date, and a sourced value must not carry one.
function assertVerification(record, label) {
  if ((record.verificationStatus === 'agent-cross-checked') !== Boolean(record.crossCheckedAt)) throw new Error(`Verification label and date differ on ${label}`)
}
const calendarDate = value => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
function assertDates(record, label, asOf) {
  if (!calendarDate(record.checkedAt) || !calendarDate(record.nextCheckAt) || record.nextCheckAt < record.checkedAt ||
    record.checkedAt > asOf || record.crossCheckedAt && (!calendarDate(record.crossCheckedAt) || record.crossCheckedAt < record.checkedAt || record.crossCheckedAt > asOf)) {
    throw new Error(`Invalid or future check date on ${label}`)
  }
}
export function validatePackage(data, asOf = new Date().toISOString().slice(0, 10)) {
  const { index, definitions, products, notices, status, methodology } = data
  if (!calendarDate(asOf) || !calendarDate(index.generatedAt) || index.generatedAt > asOf) throw new Error('Invalid or future package date')
  assertShape(definitions, object({ schemaVersion: choice(1), unknownValue: choice('unknown'), booleanValues: strings, facets: array(object({ id: text, label: text, type: choice('enum', 'tri-state'), multiple: optional(value => typeof value === 'boolean'), description: text, options: optional(array(object({ id: text, label: text, addedAt: optional(text) }))) })) }))
  const facetSchemas = {}, columnSchemas = {}
  for (const f of definitions.facets) {
    facetSchemas[f.id] = f.multiple ? object(Object.fromEntries(f.options.map(o => [o.id, receipt(['yes', 'no'])]))) : receipt(f.type === 'tri-state' ? ['yes', 'no'] : f.options.map(o => o.id))
    for (const key of f.type === 'tri-state' ? [f.id] : f.options.map(o => `${f.id}:${o.id}`)) columnSchemas[key] = object({ yes: text, no: text, crossChecked: text })
  }
  assertShape(index, object({ schemaVersion: choice(1), generatedAt: text, products: array(object(searchIdentity)), bitsets: object({ encoding: choice('base64'), bitOrder: choice('least-significant-bit-first'), rowOrder: choice('products'), unknown: choice('neither-yes-nor-no'), columns: object(columnSchemas) }) }))
  for (const p of products) assertShape(p, p.researchStatus === 'not-researched' ? object(identity) : object({ ...searchIdentity, repository: nullable(url), githubStars: optional(object({ value: number, observedAt: text, evidenceIds: strings })), lifecycle, sourcedClaimCount: number, crossCheckedClaimCount: number, oldestCheckedAt: maybeText, lastCheckedAt: maybeText, facets: object(facetSchemas), claims: array(claim), sources: array(source) }), `product:${p.id}`)
  assertShape(notices, array(object({ productId: text, ...lifecycleFields, facet: receipt(['active', 'sunset']), sources: array(source) })))
  assertShape(status, array(object({ id: text, productId: text, date: text, type: choice('initial-research', 'product-change', 'research-correction', 'rubric-change', 'freshness-recheck'), claimIds: strings, evidenceIds: strings })))
  assertShape(methodology, object({ schemaVersion: choice(1), rubricVersion: text, publisher: object({ name: text, url, marketParticipant: value => value === true, editorialControl: text, disclosure: text }), unknownMeans: text, verification: object({ sourced: text, 'agent-cross-checked': text, unknown: text }), freshnessDays: object({ priceAndAvailability: number, capability: number, stableArchitectureAndLicense: number }), freshnessRule: text, evidenceText: text, ranking: object({ overallScore: choice(false), order: strings, optionalOrder: strings, publisherPlacementAdvantage: choice(false) }), listingLabel: choice('not-researched'), correctionRule: text, limitations: strings }))
  if (new Set(index.products.map(p => p.id)).size !== index.products.length || products.length !== index.products.length) throw new Error('Duplicate or missing products')
  for (const [row, p] of products.entries()) {
    for (const key of Object.keys(searchIdentity)) if (JSON.stringify(p[key]) !== JSON.stringify(index.products[row][key])) throw new Error(`Index identity differs for ${p.id}`)
    const sources = new Map((p.sources || []).map(s => [s.id, s]))
    const claims = new Map((p.claims || []).map(c => [c.claimId, c]))
    for (const name of p.formerNames || []) if (!name.trim() || ![...claims.values()].some(c => {
      const surfaces = [p.name, ...c.scope.surfaces.map(surface => surface.name.split(', formerly ')[0])]
      return surfaces.some(surface => hasFormerNameFinding(p, c, name, surface))
    })) throw new Error(`Former name has no rename finding for ${p.id}`)
    if (p.githubStars && (!Number.isInteger(p.githubStars.value) || p.githubStars.value < 0 || !p.githubStars.evidenceIds.length ||
      p.githubStars.evidenceIds.some(id => !sources.has(id)) || p.githubStars.observedAt > asOf)) throw new Error(`GitHub stars without a public source for ${p.id}`)
    for (const c of claims.values()) {
      if (c.productId !== p.id) throw new Error(`Wrong-owner finding ${c.claimId}`)
      if (!c.evidenceIds.length || c.evidenceIds.some(id => !sources.has(id))) throw new Error(`Missing finding source ${c.claimId}`)
      assertVerification(c, `finding ${c.claimId}`)
      assertDates(c, `finding ${c.claimId}`, asOf)
    }
    const published = notices.find(n => n.productId === p.id)
    if (p.researchStatus === 'covered' && (p.lifecycle.status === 'sunset') !== Boolean(published)) throw new Error(`Lifecycle status differs from notices for ${p.id}`)
    for (const f of definitions.facets) {
      const notice = published
      for (const option of f.type === 'tri-state' ? [null] : f.options.map(o => o.id)) {
        const key = option ? `${f.id}:${option}` : f.id
        const cell = f.id === 'lifecycle-status' ? notice?.facet : f.multiple ? p.facets?.[f.id]?.[option] : p.facets?.[f.id]
        const value = !cell || cell.value === 'unknown' ? 'unknown' : f.multiple || f.type === 'tri-state' ? cell.value : cell.value === option ? 'yes' : 'no'
        for (const kind of ['yes', 'no', 'crossChecked']) {
          const bits = Buffer.from(index.bitsets.columns[key][kind], 'base64')
          if (bits.length !== Math.ceil(products.length / 8)) throw new Error(`Wrong bitset length ${key}`)
          const expected = kind === 'crossChecked' ? cell?.verificationStatus === 'agent-cross-checked' : value === kind
          if (Boolean(bits[row >> 3] & (1 << (row & 7))) !== Boolean(expected)) throw new Error(`Bitset differs from receipt ${p.id}:${key}`)
        }
        if (!cell || cell.value === 'unknown') {
          if (cell && (cell.claimId || cell.evidenceIds.length || cell.checkedAt || cell.nextCheckAt || cell.crossCheckedAt || cell.verificationStatus !== 'unknown')) throw new Error(`Unknown has a receipt ${p.id}:${key}`)
          continue
        }
        const pool = f.id === 'lifecycle-status' ? new Map(notice.sources.map(s => [s.id, s])) : sources
        const owner = f.id === 'lifecycle-status' ? notice : claims.get(cell.claimId)
        if (!owner || !cell.evidenceIds.length || cell.evidenceIds.some(id => !pool.has(id) || ![...owner.evidenceIds, ...(owner.questions || []).flatMap(q => q.evidenceIds)].includes(id)) || cell.nextCheckAt !== owner.nextCheckAt || cell.checkedAt < owner.checkedAt) throw new Error(`Invalid receipt ${p.id}:${key}`)
        assertVerification(cell, `filter value ${p.id}:${key}`)
        assertDates(cell, `filter value ${p.id}:${key}`, asOf)
        if (cell.verificationStatus === 'agent-cross-checked' && f.id !== 'lifecycle-status' && owner.verificationStatus !== 'agent-cross-checked') throw new Error(`Cross-checked filter on an unchecked finding ${p.id}:${key}`)
      }
    }
  }
  for (const n of notices) {
    if (!products.some(p => p.id === n.productId)) throw new Error(`Notice for an unknown product ${n.productId}`)
    assertDates(n, `notice ${n.productId}`, asOf)
    if (n.facet.claimId !== `${n.productId}:lifecycle` || n.facet.value !== n.status || n.facet.checkedAt !== n.checkedAt ||
      n.facet.crossCheckedAt !== n.crossCheckedAt || n.facet.nextCheckAt !== n.nextCheckAt ||
      JSON.stringify(n.facet.evidenceIds) !== JSON.stringify(n.evidenceIds) ||
      n.facet.verificationStatus !== (n.crossCheckedAt ? 'agent-cross-checked' : 'sourced')) throw new Error(`Lifecycle receipt differs from notice ${n.productId}`)
  }
  for (const event of status) {
    const p = products.find(x => x.id === event.productId)
    if (!p) throw new Error(`Status event for an unknown product ${event.id}`)
    const known = new Set([...(p.sources || []), ...(notices.find(n => n.productId === p.id)?.sources || [])].map(s => s.id))
    if (event.claimIds.some(id => !(p.claims || []).some(c => c.claimId === id)) || event.evidenceIds.some(id => !known.has(id))) throw new Error(`Status event without a current receipt ${event.id}`)
  }
  // Same private markers as research/publication/security.mjs, checked per string, plus asset links from the publisher's own tooling.
  const texts = []
  const collect = value => typeof value === 'string' ? texts.push(value) : value && typeof value === 'object' && Object.values(value).forEach(collect)
  collect(data)
  if (texts.some(text => /internal-file:|file:\/\/|\/home\/[^/\s]+\/|\/Users\/[^/\s]+\/|[a-z]:\\users\\|\.worktrees\/|\.ts\.net|\/files\/asset\?|podium-asset:/i.test(text))) throw new Error('Private path or internal-only text in public package')
  return true
}
export function loadPackage(rootUrl = root) {
  const json = name => JSON.parse(readFileSync(new URL(name, rootUrl), 'utf8'))
  const index = json('index.json')
  const expected = new Set(['index.json', 'facets.json', 'methodology.json', 'lifecycle-notices.json', 'status-log.json', 'products'])
  for (const name of readdirSync(rootUrl)) if (!expected.has(name)) throw new Error(`Unexpected public package file ${name}`)
  const files = readdirSync(new URL('products/', rootUrl))
  if (files.length !== index.products.length) throw new Error('Unexpected product file')
  for (const p of index.products) if (!lstatSync(new URL(`products/${p.id}.json`, rootUrl)).isFile()) throw new Error('Product symlink or missing file')
  return { index, definitions: json('facets.json'), products: index.products.map(p => json(`products/${p.id}.json`)), notices: json('lifecycle-notices.json'), status: json('status-log.json'), methodology: json('methodology.json') }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = loadPackage()
  validatePackage(data, process.env.ADE_COMPARISON_AS_OF)
  console.log(`Public data checked: ${data.products.length} products. Receipt dates, ownership and public fields verified.`)
}
