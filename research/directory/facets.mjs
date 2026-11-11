import { createHash } from 'node:crypto'

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value

export const unknownFacet = () => ({ value: 'unknown', verificationStatus: 'unknown',
  claimId: null, evidenceIds: [], checkedAt: null, crossCheckedAt: null, nextCheckAt: null })

// The reserved `<product-id>:lifecycle` ID resolves to nothing here. A lifecycle
// notice has no capability scope, so it can never support an authored mapping.
const findingFor = (product, entry) => product.claims.find(claim => claim.claimId === entry.claimId)

// Each option of a multi-select filter has its own tri-state receipt, so a new
// option does not change what an existing one means. An option marked `addedAt`
// is left out of the digest for mappings checked before that date; a mapping
// checked on or after it binds the whole revised definition. Single-choice
// filters may not use `addedAt`: a new choice can change an existing answer.
export const definitionAt = (definition, checkedAt) => definition.multiple && definition.options?.some(item => item.addedAt)
  ? { ...definition, options: definition.options.filter(item => !item.addedAt || (checkedAt ?? '') >= item.addedAt) }
  : definition

export function facetReviewHash(product, facetId, option, entry, definition) {
  const finding = findingFor(product, entry)
  const { review: _review, contentHash: _hash, ...mapping } = entry
  return createHash('sha256').update(JSON.stringify(canonical({
    productId: product.id, facetId, option, definition: definitionAt(definition, entry.checkedAt), mapping, finding,
    evidence: entry.evidenceIds.map(id => product.sources.find(source => source.id === id) ?? null),
  }))).digest('hex')
}

const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

// Lifecycle is already typed at the publication boundary. Copy its verification
// and dates without adding an interpretation or changing the original receipt.
export function projectPublicLifecycle(product, date) {
  const finding = product.lifecycle
  if (finding?.status !== 'sunset' || !isDate(finding.checkedAt) || finding.crossCheckedAt !== null && !isDate(finding.crossCheckedAt) ||
    !isDate(finding.nextCheckAt) || finding.checkedAt > date || finding.crossCheckedAt > date ||
    !finding.evidenceIds?.length || finding.evidenceIds.some(id =>
      !id.startsWith(`${product.id}:`) || !product.sources.some(source => source.id === id))) return unknownFacet()
  return { value: finding.status, verificationStatus: finding.crossCheckedAt ? 'agent-cross-checked' : 'sourced', claimId: `${product.id}:lifecycle`,
    evidenceIds: [...finding.evidenceIds], checkedAt: finding.checkedAt,
    crossCheckedAt: finding.crossCheckedAt, nextCheckAt: finding.nextCheckAt }
}

// A positive value needs something a reader can use today. A negative value may
// rest on a removal or a preview restriction, but never on an announcement.
const availabilitySupports = (availability, value) => availability !== 'announced' &&
  (value === 'no' || !['removed', 'private-preview'].includes(availability))
const supportContradicts = (support, value) => value === 'yes' && support === 'unsupported' ||
  value === 'no' && support === 'supported'

export function publicFacet(product, definition, option, entry, date) {
  if (!entry || entry.value === 'unknown') return unknownFacet()
  const finding = findingFor(product, entry)
  const allowed = definition.type === 'tri-state' || definition.multiple
    ? ['yes', 'no'] : definition.options.map(item => item.id)
  if (!allowed.includes(entry.value)) throw new Error(`Invalid facet value for ${definition.id}`)
  if (!finding || !['sourced', 'agent-cross-checked'].includes(finding.verificationStatus) ||
    !availabilitySupports(finding.availability, entry.value) || supportContradicts(finding.support, entry.value) ||
    !isDate(entry.checkedAt) || entry.checkedAt > date ||
    entry.checkedAt < finding.checkedAt || finding.checkedAt > date ||
    !entry.researcher?.trim() || !entry.evidenceIds?.length) return unknownFacet()
  const cited = new Set([...finding.evidenceIds, ...(finding.questions ?? []).flatMap(q => q.evidenceIds)])
  if (entry.evidenceIds.some(id => !cited.has(id) || !id.startsWith(`${product.id}:`) ||
    !product.sources.some(source => source.id === id))) return unknownFacet()
  // A rechecked finding must not lend its new date to a mapping whose own sources
  // were not read in that pass. This is the claim gate, applied to this citation.
  if (!entry.evidenceIds.some(id => product.sources.find(source => source.id === id).retrievedAt >= finding.checkedAt)) return unknownFacet()
  const hash = facetReviewHash(product, definition.id, option, entry, definition)
  if (entry.contentHash !== hash) return unknownFacet()
  const review = entry.review
  // A reviewer rejected exactly this mapping. It stays out until a revision changes the digest.
  if (review?.state === 'changes-requested' && review.contentHash === hash) return unknownFacet()
  const crossChecked = finding.verificationStatus === 'agent-cross-checked' && review?.state === 'accepted' &&
    review.reviewer?.trim() && review.reviewer.trim().toLowerCase() !== entry.researcher.trim().toLowerCase() &&
    isDate(review.date) && review.date >= entry.checkedAt && review.date <= date &&
    review.contentHash === hash
  return { value: entry.value, verificationStatus: crossChecked ? 'agent-cross-checked' : 'sourced',
    claimId: entry.claimId, evidenceIds: [...entry.evidenceIds], checkedAt: entry.checkedAt,
    crossCheckedAt: crossChecked ? review.date : null, nextCheckAt: finding.nextCheckAt }
}

export function validateDefinitions(document) {
  if (document?.schemaVersion !== 1 || document.unknownValue !== 'unknown' ||
    JSON.stringify(document.booleanValues) !== JSON.stringify(['yes', 'no', 'unknown']) ||
    !Array.isArray(document.facets)) throw new Error('Invalid facet definitions')
  const ids = new Set()
  for (const facet of document.facets) {
    if (!/^[a-z][a-z0-9-]*$/.test(facet.id) || ids.has(facet.id)) throw new Error(`Invalid or duplicate facet: ${facet.id}`)
    ids.add(facet.id)
    if (!['enum', 'tri-state'].includes(facet.type) || typeof facet.label !== 'string' || !facet.label.trim() ||
      typeof facet.description !== 'string' || !facet.description.trim() ||
      facet.multiple !== undefined && typeof facet.multiple !== 'boolean' ||
      facet.type === 'tri-state' && (facet.multiple || facet.options)) throw new Error(`Invalid facet: ${facet.id}`)
    if (facet.type === 'enum' && (!facet.options?.length ||
      new Set(facet.options.map(item => item.id)).size !== facet.options.length ||
      facet.options.some(item => !/^[a-z0-9][a-z0-9-]*$/.test(item.id) || item.id === 'unknown' || !item.label))) {
      throw new Error(`Invalid enum options: ${facet.id}`)
    }
    if ((facet.options ?? []).some(item => item.addedAt !== undefined && (!facet.multiple || !isDate(item.addedAt)))) {
      throw new Error(`Invalid option addedAt: ${facet.id}`)
    }
  }
}

export function productFacets(product, definitions, mappings, date) {
  const declared = new Map(definitions.facets.map(facet => [facet.id, facet]))
  for (const [id, record] of Object.entries(mappings ?? {})) {
    const definition = declared.get(id)
    if (!definition) throw new Error(`Undeclared facet ${id} for ${product.id}`)
    if (id === 'lifecycle-status') throw new Error('Lifecycle facets project publicLifecycle; do not author a parallel mapping')
    if (definition.multiple) for (const option of Object.keys(record)) {
      if (!definition.options.some(item => item.id === option)) throw new Error(`Undeclared option ${id}.${option}`)
    }
  }
  return Object.fromEntries(definitions.facets.map(definition => [definition.id,
    definition.id === 'lifecycle-status' ? projectPublicLifecycle(product, date)
      : definition.multiple ? Object.fromEntries(definition.options.map(option => [option.id,
      publicFacet(product, definition, option.id, mappings?.[definition.id]?.[option.id], date)]))
      : publicFacet(product, definition, null, mappings?.[definition.id], date),
  ]))
}
