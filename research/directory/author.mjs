// Authoring helper for typed facet mappings and claim reviews.
//
//   node research/directory/author.mjs status <product>...
//   node research/directory/author.mjs bind <product> <facet[:option]>...
//   node research/directory/author.mjs review-facets <product> <reviewer> <facet[:option]>...
//   node research/directory/author.mjs reject-facets <product> <reviewer> "<note>" <facet[:option]>...
//   node research/directory/author.mjs review-claims <product> <reviewer> <criterionId>...
//   node research/directory/author.mjs apply <spec.json>
//
// `status` lists each mapping's digest and review state and each claim's review state.
// `bind` records the current digest on mappings the researcher has rechecked at the source.
// It never touches a review: a changed digest leaves the old review unmatched.
// The review commands are for a different agent who has read the cited sources. They refuse
// self-review and a mapping or claim whose researcher matches the reviewer.
// Dates come from ADE_COMPARISON_PUBLICATION_DATE or today (UTC).
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPublicationFromProfiles, publicationDate } from '../publication/build.mjs'
import { loadProducts, claimReviewHash, catalogDir, afterDays } from '../lib.mjs'
import { facetReviewHash, publicFacet } from './facets.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const definitions = JSON.parse(readFileSync(resolve(here, 'facets.json'), 'utf8'))
const mappingPath = id => resolve(here, 'products', `${id}.json`)
const profilePath = id => resolve(catalogDir, 'products', `${id}.json`)
// Keep each file's existing indentation so diffs show only content changes.
const indentOf = path => { try { return /^\{\n( +)/.exec(readFileSync(path, 'utf8'))?.[1].length ?? 2 } catch { return 2 } }
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, indentOf(path))}\n`)

const date = publicationDate()
const publicProduct = (id, profiles = loadProducts()) => {
  const publication = buildPublicationFromProfiles(profiles, { date, format: 'products', directory: true })
  const product = publication.products.find(row => row.id === id)
  if (!product) throw new Error(`No public record for ${id}`)
  return product
}

const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const checkEvidenceDates = item => {
  if (!isDate(item.retrievedAt) || item.retrievedAt > date) throw new Error(`${item.id}: retrievedAt must be a calendar date on or before the pass date`)
  if (item.sourceDate !== null && (!isDate(item.sourceDate) || item.sourceDate > item.retrievedAt))
    throw new Error(`${item.id}: sourceDate must be a calendar date on or before retrievedAt`)
}

const entries = mappings => Object.entries(mappings).flatMap(([facetId, value]) => {
  const definition = definitions.facets.find(f => f.id === facetId)
  if (!definition) throw new Error(`Unknown facet ${facetId}`)
  return definition.multiple
    ? Object.entries(value).map(([option, entry]) => ({ key: `${facetId}:${option}`, facetId, option, entry, definition }))
    : [{ key: facetId, facetId, option: null, entry: value, definition }]
})

const [command, id, ...rest] = process.argv.slice(2)
if (!command || !id) throw new Error('Usage: author.mjs status|bind|review-facets|review-claims <product> ...')

if (command === 'status') {
  for (const productId of [id, ...rest]) {
    const product = publicProduct(productId)
    const mappings = JSON.parse(readFileSync(mappingPath(productId), 'utf8'))
    for (const { key, facetId, option, entry, definition } of entries(mappings)) {
      const hash = facetReviewHash(product, facetId, option, entry, definition)
      const bound = entry.contentHash === hash
      const reviewed = entry.review?.state === 'accepted' && entry.review.contentHash === hash
      console.log(`${productId}\t${key}\t${entry.value}\t${bound ? 'bound' : 'STALE'}\t${reviewed ? 'reviewed' : entry.review ? `review-${entry.review.contentHash === hash ? entry.review.state : 'stale'}` : 'unreviewed'}\t${entry.claimId}`)
    }
    const profile = JSON.parse(readFileSync(profilePath(productId), 'utf8'))
    for (const claim of profile.claims) {
      if (claim.support === 'unknown') continue
      const ok = claim.review && claim.review.contentHash === claimReviewHash(profile, claim)
      console.log(`${productId}\tclaim ${claim.criterionId}\t${claim.support}\t${claim.publication}\t${ok ? 'reviewed' : claim.review ? 'review-stale' : 'unreviewed'}`)
    }
  }
} else if (command === 'bind' || command === 'review-facets' || command === 'reject-facets') {
  const reviewer = command === 'bind' ? null : rest.shift()
  const reject = command === 'reject-facets' ? rest.shift() : null
  if (command !== 'bind' && !reviewer) throw new Error('Reviewer required')
  if (command === 'reject-facets' && !reject?.trim()) throw new Error('A rejection needs a note')
  const product = publicProduct(id)
  const mappings = JSON.parse(readFileSync(mappingPath(id), 'utf8'))
  const wanted = new Set(rest)
  let count = 0
  for (const { key, facetId, option, entry, definition } of entries(mappings)) {
    const hash = facetReviewHash(product, facetId, option, entry, definition)
    if (command === 'bind') {
      if (!wanted.has(key)) continue
      entry.contentHash = hash
      count++
    } else {
      if (!wanted.has(key)) continue
      if (entry.researcher.trim().toLowerCase() === reviewer.trim().toLowerCase()) throw new Error(`${key}: reviewer is the researcher`)
      if (entry.contentHash !== hash) {
        // A claim review changes only the finding's verification fields. When the stored
        // digest matches the same finding as sourced, the mapping, sources and finding facts
        // are unchanged, so the reviewer who checked them can bind the new digest.
        const asSourced = { ...product, claims: product.claims.map(c => c.claimId === entry.claimId
          ? { ...c, verificationStatus: 'sourced', crossCheckedAt: null } : c) }
        if (entry.contentHash !== facetReviewHash(asSourced, facetId, option, entry, definition))
          throw new Error(`${key} is not bound to its current finding; the researcher must recheck and bind it first`)
        entry.contentHash = hash
      }
      entry.review = { state: reject ? 'changes-requested' : 'accepted', reviewer, date, contentHash: hash, ...(reject ? { note: reject } : {}) }
      count++
    }
  }
  write(mappingPath(id), mappings)
  console.log(`${command}: ${count} mapping(s) in ${id}`)
} else if (command === 'review-claims') {
  const reviewer = rest.shift()
  if (!reviewer || !rest.length) throw new Error('Reviewer and criterion IDs required')
  const profile = JSON.parse(readFileSync(profilePath(id), 'utf8'))
  for (const criterionId of rest) {
    const claim = profile.claims.find(row => row.criterionId === criterionId)
    if (!claim) throw new Error(`Missing claim ${criterionId}`)
    if (claim.researcher.trim().toLowerCase() === reviewer.trim().toLowerCase()) throw new Error(`${criterionId}: reviewer is the researcher`)
    if (!claim.evidenceIds.length && !Object.values(claim.subanswers).some(a => a.evidenceIds.length)) throw new Error(`${criterionId}: no evidence`)
    if (claim.support === 'unknown' || claim.contradictions.length || !claim.scope.surfaceIds.length) throw new Error(`${criterionId}: an unknown, contradicted or unscoped claim cannot be public-reviewed`)
    claim.review = { reviewer, date, contentHash: claimReviewHash(profile, claim) }
    claim.publication = 'public-reviewed'
  }
  write(profilePath(id), profile)
  console.log(`review-claims: ${rest.length} claim(s) in ${id}`)
} else if (command === 'apply') {
  applyPass(JSON.parse(readFileSync(resolve(id), 'utf8')))
} else throw new Error(`Unknown command ${command}`)

// Apply one researcher's source pass for one product from a declarative spec:
// { product, researcher, summary, evidence: [...], claims: { <criterionId>: patch },
//   mappings: { "<facet>" | "<facet>:<option>": { value, claim, evidenceIds, rationale } },
//   rebind: ["<facet>[:<option>]", ...] }
// A claim patch may set answer, support, availability, delivery, scope, limitations,
// unknownReason, contradictions, checkedAt, nextReviewAt, and per-question subanswers.
// `evidenceIds` is merged. An explicit checkedAt records a cited source recheck;
// nextReviewAt defaults to the criterion's review interval from that date. Without
// checkedAt, existing findings keep both dates; unknown findings use the pass date.
// Rechecks leave untouched atomic answers and older evidence dates alone and clear
// the claim review. Evidence retrievedAt defaults to the pass date. `rebind` names
// existing mappings rechecked against the revised finding.
function applyPass(spec) {
  const { product: productId, researcher, summary } = spec
  if (!productId || !researcher || !summary) throw new Error('Spec needs product, researcher and summary')
  const profile = JSON.parse(readFileSync(profilePath(productId), 'utf8'))
  const known = new Set(profile.evidence.map(e => e.id))
  for (const item of spec.evidence ?? []) {
    if (known.has(item.id)) throw new Error(`Evidence ${item.id} already exists`)
    if (item.kind === 'source-inspected' && (!item.commit || !item.path)) throw new Error(`${item.id} needs commit and path`)
    const evidence = { id: item.id, kind: item.kind, url: item.url, title: item.title, locator: item.locator,
      sourceDate: item.sourceDate ?? null, retrievedAt: Object.hasOwn(item, 'retrievedAt') ? item.retrievedAt : date, finding: item.finding, visibility: 'public',
      commit: item.commit ?? null, path: item.path ?? null }
    checkEvidenceDates(evidence)
    profile.evidence.push(evidence)
    known.add(item.id)
  }
  const days = { 'OWN-04': 60, 'OWN-08': 60, 'OWN-01': 180, 'OWN-02': 180, 'ACC-07': 180 }
  for (const [criterionId, patch] of Object.entries(spec.claims ?? {})) {
    const claim = profile.claims.find(row => row.criterionId === criterionId)
    if (!claim) throw new Error(`Missing claim ${criterionId}`)
    const before = { support: claim.support, answer: claim.answer, checkedAt: claim.checkedAt, nextReviewAt: claim.nextReviewAt,
      subanswers: Object.fromEntries(Object.keys(patch.subanswers ?? {}).map(k => [k, claim.subanswers[k]?.support])) }
    const wasUnknown = claim.support === 'unknown'
    const rechecked = wasUnknown || Object.hasOwn(patch, 'checkedAt')
    if (Object.hasOwn(patch, 'nextReviewAt') && !rechecked) throw new Error(`${criterionId}: nextReviewAt needs an explicit checkedAt source recheck`)
    const { subanswers = {}, scope, evidenceIds = [], checkedAt = wasUnknown ? date : claim.checkedAt,
      nextReviewAt: deadline, ...fields } = patch
    if (rechecked && (!isDate(checkedAt) || checkedAt > date)) throw new Error(`${criterionId}: checkedAt must be a calendar date on or before the pass date`)
    const nextReviewAt = Object.hasOwn(patch, 'nextReviewAt') ? deadline
      : rechecked ? afterDays(checkedAt, days[criterionId] ?? 120) : claim.nextReviewAt
    if (rechecked && (!isDate(nextReviewAt) || nextReviewAt < checkedAt)) throw new Error(`${criterionId}: nextReviewAt must be a calendar date on or after checkedAt`)
    for (const key of Object.keys(fields)) if (!['answer', 'support', 'availability', 'delivery', 'limitations', 'unknownReason', 'contradictions'].includes(key)) throw new Error(`${criterionId}: field ${key} is not patchable`)
    Object.assign(claim, fields)
    if (scope) Object.assign(claim.scope, scope)
    for (const [key, value] of Object.entries(subanswers)) {
      if (!claim.subanswers[key]) throw new Error(`Undeclared subquestion ${criterionId}.${key}`)
      claim.subanswers[key] = { ...claim.subanswers[key], ...value }
    }
    const cited = [...evidenceIds, ...Object.values(subanswers).flatMap(a => a.evidenceIds ?? [])]
    for (const ev of cited) if (!known.has(ev)) throw new Error(`${criterionId}: unknown evidence ${ev}`)
    claim.evidenceIds = [...new Set([...claim.evidenceIds, ...cited])]
    if (rechecked) {
      const ids = new Set([...claim.evidenceIds, ...Object.values(claim.subanswers).flatMap(a => a.evidenceIds)])
      const evidence = profile.evidence.filter(item => ids.has(item.id))
      evidence.forEach(checkEvidenceDates)
      if (claim.support !== 'unknown' && !evidence.some(item => item.visibility === 'public' && item.kind !== 'unresolved' && item.retrievedAt >= checkedAt))
        throw new Error(`${criterionId}: checkedAt needs a cited source recheck on or after ${checkedAt}`)
      claim.checkedAt = checkedAt
      claim.nextReviewAt = nextReviewAt
    }
    if (wasUnknown) {
      if (claim.support !== 'unknown') claim.unknownReason = patch.unknownReason ?? (Object.values(claim.subanswers).some(a => a.support === 'unknown') ? 'See unknown atomic answers for the source and test gaps.' : null)
    }
    claim.researcher = researcher
    claim.review = null
    if (claim.support !== 'unknown' && claim.publication !== 'public-candidate') claim.publication = 'public-candidate'
    profile.changes.push({ date, author: researcher, type: 'research-correction', summary,
      claimIds: [claim.id], before, after: { support: claim.support, answer: claim.answer, checkedAt: claim.checkedAt, nextReviewAt: claim.nextReviewAt,
        subanswers: Object.fromEntries(Object.keys(subanswers).map(k => [k, claim.subanswers[k].support])) },
      evidenceIds: [...new Set(cited)] })
  }
  const path = mappingPath(productId)
  const mappings = JSON.parse(readFileSync(path, 'utf8'))
  const product = publicProduct(productId, [profile])
  const keys = []
  for (const [key, m] of Object.entries(spec.mappings ?? {})) {
    const [facetId, option = null] = key.split(':')
    const definition = definitions.facets.find(f => f.id === facetId)
    if (!definition || (definition.multiple ? !definition.options.some(o => o.id === option) : option)) throw new Error(`Bad facet key ${key}`)
    const existing = definition.multiple ? mappings[facetId]?.[option] : mappings[facetId]
    if (existing && existing.value === m.value && existing.claimId === `${productId}:${m.claim}`) throw new Error(`${key} already maps ${m.value}; use rebind`)
    const entry = { value: m.value, claimId: `${productId}:${m.claim}`, evidenceIds: m.evidenceIds.map(e => `${productId}:${e}`),
      checkedAt: date, rationale: m.rationale, researcher, contentHash: '', review: null }
    if (definition.multiple) (mappings[facetId] ??= {})[option] = entry
    else mappings[facetId] = entry
    keys.push({ key, facetId, option, entry, definition })
  }
  for (const key of spec.rebind ?? []) {
    const [facetId, option = null] = key.split(':')
    const definition = definitions.facets.find(f => f.id === facetId)
    const entry = definition.multiple ? mappings[facetId]?.[option] : mappings[facetId]
    if (!entry) throw new Error(`Nothing to rebind at ${key}`)
    keys.push({ key, facetId, option, entry, definition })
  }
  for (const { key, facetId, option, entry, definition } of keys) {
    entry.contentHash = facetReviewHash(product, facetId, option, entry, definition)
    // An accepted review bound to the old digest no longer applies; a rejection stays on record.
    if (entry.review?.state === 'accepted' && entry.review.contentHash !== entry.contentHash) entry.review = null
    const cell = publicFacetCheck(product, definition, option, entry)
    if (cell.value === 'unknown') throw new Error(`${key} does not publish; check claim support, citations and dates`)
  }
  // Warn about mappings left stale by the claim edits.
  for (const { key, facetId, option, entry, definition } of entries(mappings))
    if (entry.contentHash !== facetReviewHash(product, facetId, option, entry, definition)) console.warn(`STALE after pass: ${productId} ${key} (recheck, then add to rebind)`)
  write(profilePath(productId), profile)
  write(path, mappings)
  console.log(`apply: ${productId}: ${Object.keys(spec.claims ?? {}).length} claim(s), ${Object.keys(spec.mappings ?? {}).length} new mapping(s), ${(spec.rebind ?? []).length} rebound`)
}

function publicFacetCheck(product, definition, option, entry) {
  return publicFacet(product, definition, option, entry, date)
}
