import { validateDefinitions } from './facets.mjs'

export function hasFormerNameFinding(product, claim, name, surface = product.name) {
  if (typeof surface !== 'string' || !surface.startsWith(product.name)) return false
  return [',', ' (', ' '].some(next => claim.answer.includes(`${surface}, formerly ${name}${next}`))
}

// Every object has an exact public shape. Primitive fields cannot hide nested
// objects, and newly added private fields fail even before the text scan.
const object = fields => ({ object: fields })
const list = item => ({ list: item })
const nullable = item => ({ nullable: item })
const optional = item => ({ optional: item })
const choice = (...values) => ({ choice: values })
const textOrNull = nullable(String)
const strings = list(String)
const check = (value, rule, path) => {
  if (rule === String || rule === Number || rule === Boolean) {
    const type = rule.name.toLowerCase()
    if (typeof value !== type || type === 'number' && !Number.isFinite(value)) throw new Error(`Expected ${type} at ${path}`)
  } else if (typeof rule === 'function') rule(value, path)
  else if (rule.optional) { if (value !== undefined) check(value, rule.optional, path) }
  else if (rule.nullable) { if (value !== null) check(value, rule.nullable, path) }
  else if (rule.choice) {
    if (!rule.choice.includes(value)) throw new Error(`Invalid public value at ${path}`)
  } else if (rule.list) {
    if (!Array.isArray(value)) throw new Error(`Expected array at ${path}`)
    value.forEach((item, index) => check(item, rule.list, `${path}[${index}]`))
  } else {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected object at ${path}`)
    for (const key of Object.keys(value)) if (!Object.hasOwn(rule.object, key)) throw new Error(`Unexpected public field at ${path}.${key}`)
    for (const [key, item] of Object.entries(rule.object)) check(value[key], item, `${path}.${key}`)
  }
}
const privateHost = /^(?:localhost|\[.*\]|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)$|\.(?:local|localhost|internal|lan|ts\.net)$/i
const secretParameter = /^(?:token|access_token|api_?key|key|secret|password|sig|signature|x-amz-signature)$/i
const publicUrl = (value, path) => {
  check(value, String, path)
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password ||
    privateHost.test(url.hostname) || [...url.searchParams.keys()].some(key => secretParameter.test(key))) {
    throw new Error(`Expected public URL at ${path}`)
  }
}
const identityFields = { id: String, name: String, website: nullable(publicUrl), researchStatus: choice('covered', 'not-researched') }
const searchIdentityFields = { ...identityFields, formerNames: optional(strings) }
const lifecycleFields = { status: choice('sunset'), note: String, scope: String, continuation: textOrNull,
  announcementDate: textOrNull, serviceEndDate: textOrNull, checkedAt: String, crossCheckedAt: textOrNull, nextCheckAt: String, evidenceIds: strings }
const lifecycle = (value, path) => check(value, value?.status === 'unknown'
  ? object({ status: choice('unknown'), note: choice(null) }) : object(lifecycleFields), path)
const receipt = values => object({ value: choice('unknown', ...values),
  verificationStatus: choice('unknown', 'sourced', 'agent-cross-checked'), claimId: textOrNull,
  evidenceIds: strings, checkedAt: textOrNull, crossCheckedAt: textOrNull, nextCheckAt: textOrNull })
const source = object({ id: String, productId: String, kind: String, url: publicUrl, title: String, locator: String,
  sourceDate: textOrNull, retrievedAt: String, finding: String, commit: optional(String), path: optional(String),
  method: optional(String), configuration: optional(String), fixture: optional(String), result: optional(String) })
const claim = object({ productId: String, claimId: String, verificationStatus: choice('sourced', 'agent-cross-checked'),
  answer: String, availability: String, delivery: String,
  scope: object({ surfaceIds: strings, version: textOrNull, plan: textOrNull, os: strings, executionModes: strings,
    region: textOrNull, harness: textOrNull, surfaces: list(object({ id: String, name: String, type: String })) }),
  questions: list(object({ id: String, question: String, support: String, answer: String, evidenceIds: strings })),
  limitations: strings, checkedAt: String, crossCheckedAt: textOrNull, nextCheckAt: String, evidenceIds: strings })
const option = object({ id: String, label: String, addedAt: optional(String) })

const expectedCell = (cell, path) => {
  if (cell.value === 'unknown') {
    if (cell.verificationStatus !== 'unknown' || cell.claimId !== null || cell.evidenceIds.length ||
      cell.checkedAt !== null || cell.crossCheckedAt !== null || cell.nextCheckAt !== null) throw new Error(`Unknown cell carries a receipt at ${path}`)
    return false
  }
  if (cell.verificationStatus === 'unknown' || !cell.claimId || !cell.evidenceIds.length || !cell.checkedAt || !cell.nextCheckAt ||
    (cell.verificationStatus === 'agent-cross-checked') !== Boolean(cell.crossCheckedAt)) throw new Error(`Filter value has no receipt at ${path}`)
  return true
}
const claimCitations = claim => [...claim.evidenceIds, ...claim.questions.flatMap(question => question.evidenceIds)]

// A filter value can never exist without a receipt. The builder upholds this, and
// this check proves it for files that did not come straight from the builder.
function assertReceipts(data) {
  const definitions = data.facets.facets
  const notices = new Map(data.lifecycleNotices.map(notice => [notice.productId, notice]))
  const products = new Map(data.products.map(product => [product.id, product]))
  for (const productId of notices.keys()) if (!products.has(productId)) throw new Error(`Lifecycle notice for unlisted product ${productId}`)
  for (const product of data.products.filter(item => item.facets)) {
    const sources = new Map(product.sources.map(source => [source.id, source]))
    const claims = new Map(product.claims.map(claim => [claim.claimId, claim]))
    if (product.sources.some(source => source.productId !== product.id)) throw new Error(`Foreign source in ${product.id}`)
    for (const claim of product.claims) if (claim.productId !== product.id || claimCitations(claim).some(id => !sources.has(id))) {
      throw new Error(`Unresolved claim citation for ${claim.claimId}`)
    }
    if (product.githubStars && (!Number.isInteger(product.githubStars.value) || product.githubStars.value < 0 ||
      !product.githubStars.evidenceIds.length || product.githubStars.evidenceIds.some(id => !sources.has(id)))) {
      throw new Error(`GitHub stars without a public source for ${product.id}`)
    }
    for (const name of product.formerNames ?? []) if (!name.trim() || !product.claims.some(claim => {
      // The private entry's surface is not exported. Verify it against the
      // public finding's own surfaces, including names that retain lineage.
      const surfaces = [product.name, ...claim.scope.surfaces.map(surface => surface.name.split(', formerly ')[0])]
      return surfaces.some(surface => hasFormerNameFinding(product, claim, name, surface))
    })) {
      throw new Error(`Former name has no rename finding for ${product.id}`)
    }
    for (const facet of definitions) {
      const record = product.facets[facet.id]
      for (const [option, cell] of facet.multiple ? Object.entries(record) : [[null, record]]) {
        const path = `${product.id}.${facet.id}${option ? `.${option}` : ''}`
        if (facet.id === 'lifecycle-status') {
          const notice = notices.get(product.id)
          if (expectedCell(cell, path) !== Boolean(notice) || (notice && JSON.stringify(cell) !== JSON.stringify(notice.facet))) {
            throw new Error(`Lifecycle filter differs from its notice at ${path}`)
          }
          continue
        }
        if (!expectedCell(cell, path)) continue
        const claim = claims.get(cell.claimId)
        if (!claim || cell.nextCheckAt !== claim.nextCheckAt || cell.checkedAt < claim.checkedAt ||
          (cell.verificationStatus === 'agent-cross-checked' && claim.verificationStatus !== 'agent-cross-checked') ||
          cell.evidenceIds.some(id => !sources.has(id) || !claimCitations(claim).includes(id))) {
          throw new Error(`Filter value has no matching receipt at ${path}`)
        }
      }
    }
  }
  for (const event of data.statusLog) {
    const product = products.get(event.productId)
    if (!product) throw new Error(`Status event for unlisted product ${event.id}`)
    const sources = new Set([...(product.sources ?? []), ...(notices.get(event.productId)?.sources ?? [])].map(source => source.id))
    if (event.evidenceIds.some(id => !sources.has(id)) ||
      event.claimIds.some(id => !product.claims?.some(claim => claim.claimId === id))) throw new Error(`Unresolved status event ${event.id}`)
  }
}

// A due date is a research reminder. Dates after publication are still invalid;
// overdue findings remain visible with their original check dates.
export function assertDirectoryFresh(data, date) {
  if (data.index.generatedAt > date) throw new Error(`Public package dated after ${date}`)
  const cells = data.products.flatMap(product => [...(product.claims ?? []), ...Object.values(product.facets ?? {})
    .flatMap(value => typeof value.value === 'string' ? [value] : Object.values(value))])
  for (const product of data.products) if (product.githubStars?.observedAt > date) throw new Error(`GitHub stars dated after ${date}`)
  for (const item of [...cells, ...data.lifecycleNotices]) if (item.checkedAt && item.checkedAt > date || item.crossCheckedAt && item.crossCheckedAt > date) {
    throw new Error(`Public finding dated after ${date}`)
  }
}

export function assertDirectoryShape(data) {
  validateDefinitions(data.facets)
  const definitions = data.facets.facets
  const columns = {}
  const facets = {}
  for (const facet of definitions) {
    const cells = facet.type === 'tri-state' || facet.multiple ? receipt(['yes', 'no']) : receipt(facet.options.map(o => o.id))
    facets[facet.id] = facet.multiple ? object(Object.fromEntries(facet.options.map(o => [o.id, cells]))) : cells
    for (const id of facet.type === 'tri-state' ? [facet.id] : facet.options.map(o => `${facet.id}:${o.id}`)) {
      columns[id] = object({ yes: String, no: String, crossChecked: String })
    }
  }
  const product = (value, path) => check(value, value?.researchStatus === 'not-researched' ? object(identityFields)
    : object({ ...searchIdentityFields, repository: nullable(publicUrl),
      githubStars: optional(object({ value: Number, observedAt: String, evidenceIds: strings })), lifecycle,
      sourcedClaimCount: Number, crossCheckedClaimCount: Number, oldestCheckedAt: textOrNull, lastCheckedAt: textOrNull,
      facets: object(facets), claims: list(claim), sources: list(source) }), path)
  check(data, object({
    index: object({ schemaVersion: choice(1), generatedAt: String, products: list(object(searchIdentityFields)),
      bitsets: object({ encoding: choice('base64'), bitOrder: choice('least-significant-bit-first'),
        rowOrder: choice('products'), unknown: choice('neither-yes-nor-no'), columns: object(columns) }) }),
    facets: object({ schemaVersion: choice(1), unknownValue: choice('unknown'), booleanValues: strings,
      facets: list(object({ id: String, label: String, type: choice('enum', 'tri-state'), description: String,
        multiple: optional(Boolean), options: optional(list(option)) })) }),
    products: list(product),
    statusLog: list(object({ id: String, productId: String, date: String,
      type: choice('initial-research', 'product-change', 'research-correction', 'rubric-change', 'freshness-recheck'),
      claimIds: strings, evidenceIds: strings })),
    lifecycleNotices: list(object({ productId: String, ...lifecycleFields,
      facet: receipt(['active', 'sunset']), sources: list(source) })),
    methodology: object({ schemaVersion: choice(1), rubricVersion: String,
      publisher: object({ name: String, url: publicUrl, marketParticipant: Boolean, editorialControl: String, disclosure: String }),
      unknownMeans: String, verification: object({ sourced: String, 'agent-cross-checked': String, unknown: String }),
      freshnessDays: object({ priceAndAvailability: Number, capability: Number, stableArchitectureAndLicense: Number }),
      freshnessRule: String, evidenceText: String, ranking: object({ overallScore: choice(false), order: strings, optionalOrder: strings, publisherPlacementAdvantage: choice(false) }),
      listingLabel: choice('not-researched'), correctionRule: String, limitations: strings }),
  }), '$')
  if (new Set(data.products.map(p => p.id)).size !== data.products.length || data.products.length !== data.index.products.length ||
    data.products.some((product, index) => Object.keys(searchIdentityFields).some(key =>
      JSON.stringify(product[key]) !== JSON.stringify(data.index.products[index][key])))) {
    throw new Error('Public product identities do not match the index')
  }
  for (const notice of data.lifecycleNotices) {
    const cell = notice.facet
    if (cell.value !== notice.status || cell.claimId !== `${notice.productId}:lifecycle` ||
      cell.verificationStatus !== (notice.crossCheckedAt ? 'agent-cross-checked' : 'sourced') || cell.checkedAt !== notice.checkedAt ||
      cell.crossCheckedAt !== notice.crossCheckedAt || cell.nextCheckAt !== notice.nextCheckAt ||
      JSON.stringify(cell.evidenceIds) !== JSON.stringify(notice.evidenceIds) ||
      notice.evidenceIds.some(id => !notice.sources.some(source => source.id === id && source.productId === notice.productId))) {
      throw new Error('Lifecycle receipt differs from its public notice')
    }
  }
  for (const facet of definitions) for (const selected of facet.type === 'tri-state' ? [null] : facet.options.map(o => o.id)) {
    const column = data.index.bitsets.columns[selected === null ? facet.id : `${facet.id}:${selected}`]
    const decoded = Object.fromEntries(Object.entries(column).map(([key, encoded]) => {
      const bytes = Buffer.from(encoded, 'base64')
      if (bytes.toString('base64') !== encoded || bytes.length !== Math.ceil(data.products.length / 8)) {
        throw new Error(`Invalid public bitset for ${facet.id}`)
      }
      if (data.products.length % 8 && bytes.at(-1) >> (data.products.length % 8)) throw new Error(`Nonzero bitset padding for ${facet.id}`)
      return [key, bytes]
    }))
    data.products.forEach((product, index) => {
      const cell = facet.id === 'lifecycle-status' ? data.lifecycleNotices.find(notice => notice.productId === product.id)?.facet
        : facet.multiple ? product.facets?.[facet.id]?.[selected] : product.facets?.[facet.id]
      const value = !cell || cell.value === 'unknown' ? 'unknown'
        : facet.type === 'tri-state' || facet.multiple ? cell.value : cell.value === selected ? 'yes' : 'no'
      const expected = { yes: value === 'yes', no: value === 'no', crossChecked: cell?.verificationStatus === 'agent-cross-checked' }
      for (const [key, bytes] of Object.entries(decoded)) if (Boolean(bytes[index >> 3] & (1 << (index & 7))) !== expected[key]) {
        throw new Error(`Public bitset differs from receipt for ${facet.id}`)
      }
    })
  }
  assertReceipts(data)
}
