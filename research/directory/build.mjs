import { lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPublication, publicationDate } from '../publication/build.mjs'
import { assertPublicationSafe } from '../publication/security.mjs'
import { productFacets, projectPublicLifecycle, validateDefinitions } from './facets.mjs'
import { assertDirectoryFresh, assertDirectoryShape, hasFormerNameFinding } from './security.mjs'

const directory = fileURLToPath(new URL('.', import.meta.url))
export const defaultOutput = fileURLToPath(new URL('../../data/', import.meta.url))
const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const serialize = value => `${JSON.stringify(value)}\n`
export const loadFacetDefinitions = () => readJson(resolve(directory, 'facets.json'))
export const loadFormerNames = () => readJson(resolve(directory, 'former-names.json'))
export const loadFacetMappings = () => Object.fromEntries(readdirSync(resolve(directory, 'products'))
  .filter(name => name.endsWith('.json')).sort().map(name => [name.slice(0, -5), readJson(resolve(directory, 'products', name))]))

export const methodologyConstants = {
  unknownMeans: 'The available public evidence does not establish this value. Unknown is never no.',
  verification: {
    sourced: 'A claim passed the publication gates. A filter value also has a typed mapping that matches its evidence digest, without an accepted independent check of both.',
    'agent-cross-checked': 'On a claim, a different agent checked its evidence, wording, scope and dates. On a filter value, a different agent checked both the public finding and the typed mapping. Lifecycle status copies the verification of its typed notice. This does not imply a hands-on test or human claim review.',
    unknown: 'The filter value has no eligible receipt.',
  },
  freshnessDays: { priceAndAvailability: 60, capability: 120, stableArchitectureAndLicense: 180 },
  freshnessRule: 'Findings and typed values stay published after nextCheckAt. Show their checked date and age; add a quiet "may be outdated" note only after six calendar months. A rebuild never refreshes evidence.',
  evidenceText: 'Evidence contains a finding and a locator. A finding may summarize a source and must not be presented as a verbatim quote.',
  ranking: { overallScore: false, order: ['must-haves-met-descending', 'preferences-met-descending', 'name-ascending'],
    // The Finder's opt-in GitHub stars order. Products without a sourced count follow in fit order.
    optionalOrder: ['must-haves-met-descending', 'github-stars-descending', 'preferences-met-descending', 'name-ascending'], publisherPlacementAdvantage: false },
  listingLabel: 'not-researched',
  correctionRule: 'Provide a public source URL and its exact sentence. Verify the correction in the catalog before regenerating this package.',
  limitations: [
    'Documentation and source inspection do not establish successful hands-on use.',
    'Cross-checks are done by agents working for the publisher. No human has audited a sample of them yet; a human-audited sample with a published error rate is planned.',
    'A missing sourced finding is not evidence that a capability is absent.',
    'Clients, plans, versions and execution modes may have different capabilities. Read the receipt scope.',
    'Register listings identify products and contain no capability claims. A sourced first-party lifecycle notice can name a listed product before an independent cross-check.',
  ],
}

// Exact public IDs and labels. Descriptions stay subject to the private text scan.
export const facetVocabulary = definitions => [...definitions.booleanValues, definitions.unknownValue,
  ...Object.keys(methodologyConstants.verification), ...definitions.facets.flatMap(facet =>
  [facet.id, facet.label, ...(facet.options ?? []).flatMap(option => [option.id, option.label])])]
const safety = ({ privateRecords, ...options }) => ({ ...options, directory: true,
  privateRecords: privateRecords ?? Object.values(loadFacetMappings()),
  vocabulary: facetVocabulary(loadFacetDefinitions()) })

const encodeBits = (rows, predicate) => {
  const bytes = Buffer.alloc(Math.ceil(rows.length / 8))
  rows.forEach((row, index) => { if (predicate(row)) bytes[index >> 3] |= 1 << (index & 7) })
  return bytes.toString('base64')
}
const facetColumns = definitions => definitions.facets.flatMap(facet => facet.type === 'tri-state'
  ? [{ key: facet.id, facet, option: null }]
  : facet.options.map(option => ({ key: `${facet.id}:${option.id}`, facet, option: option.id })))
const indexCells = (products, definitions, notices) => Object.fromEntries(facetColumns(definitions).map(({ key, facet, option }) => {
  const cell = product => facet.id === 'lifecycle-status' ? notices.find(notice => notice.productId === product.id)?.facet
    : facet.multiple ? product.facets?.[facet.id]?.[option] : product.facets?.[facet.id]
  const value = product => {
    const finding = cell(product)
    if (!finding || finding.value === 'unknown') return 'unknown'
    if (facet.type === 'tri-state' || facet.multiple) return finding.value
    return finding.value === option ? 'yes' : 'no'
  }
  return [key, { yes: encodeBits(products, product => value(product) === 'yes'),
    no: encodeBits(products, product => value(product) === 'no'),
    crossChecked: encodeBits(products, product => cell(product)?.verificationStatus === 'agent-cross-checked') }]
}))

// Former names come from an eligible rename finding, never from private aliases.
// Keep the relationship explicit so another mention of a product name cannot
// accidentally become search identity. An ineligible finding removes its name.
export function publicFormerNames(product, entries = []) {
  return [...new Set(entries.filter(entry => {
    if (!entry.name?.trim() || !entry.evidenceIds?.length) return false
    const claim = product.claims.find(claim => claim.claimId === entry.claimId)
    if (!claim || !hasFormerNameFinding(product, claim, entry.name, entry.surface)) return false
    const cited = new Set([...claim.evidenceIds, ...claim.questions.flatMap(question => question.evidenceIds)])
    return entry.evidenceIds.every(id => cited.has(id) && product.sources.some(source => source.id === id)) &&
      entry.evidenceIds.some(id => product.sources.find(source => source.id === id).retrievedAt >= claim.checkedAt)
  }).map(entry => entry.name))]
}

// The only catalog input to this function is the sanitized products format.
export function buildDirectoryFromPublication(publication, {
  definitions = loadFacetDefinitions(), mappings = loadFacetMappings(), formerNames = loadFormerNames(),
} = {}) {
  validateDefinitions(definitions)
  const date = publication.generatedAt
  const byId = new Map(publication.products.map(product => [product.id, product]))
  for (const id of Object.keys(mappings)) if (!byId.has(id)) throw new Error(`Facet product missing from publication: ${id}`)
  const register = new Map(publication.listings.map(listing => [listing.id, listing]))
  for (const product of publication.products) if (!register.has(product.id)) register.set(product.id,
    { id: product.id, name: product.name, website: product.website })
  const products = [...register.values()].map(listing => {
    const { id, name, website } = listing
    if (!mappings[id]) return { id, name, website, researchStatus: 'not-researched' }
    const product = byId.get(id)
    const names = publicFormerNames(product, formerNames[id])
    return { id, name, website, researchStatus: 'covered', ...(names.length ? { formerNames: names } : {}), repository: product.repository,
      ...(product.githubStars ? { githubStars: product.githubStars } : {}),
      lifecycle: product.lifecycle, sourcedClaimCount: product.sourcedClaimCount,
      crossCheckedClaimCount: product.crossCheckedClaimCount,
      oldestCheckedAt: product.oldestCheckedAt, lastCheckedAt: product.lastCheckedAt,
      facets: productFacets(product, definitions, mappings[id], date),
      // The row-level support state only marks a record as answered inside the catalog.
      // It is not a rating, so the package carries the atomic answers alone.
      claims: product.claims.map(({ support: _row, ...claim }) => claim), sources: product.sources }
  }).sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en'))
  const coveredIds = new Set(products.filter(product => product.researchStatus === 'covered').map(product => product.id))
  const statusLog = publication.products.flatMap(product => product.changes
    .filter(change => coveredIds.has(product.id) || change.claimIds.length === 0))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  const lifecycleNotices = publication.products.filter(product => product.lifecycle.status === 'sunset')
    .map(product => ({ productId: product.id, ...product.lifecycle,
      facet: projectPublicLifecycle(product, date),
      sources: product.sources.filter(source => product.lifecycle.evidenceIds.includes(source.id)) }))
  return {
    index: { schemaVersion: 1, generatedAt: date,
      products: products.map(({ id, name, website, researchStatus, formerNames }) =>
        ({ id, name, website, researchStatus, ...(formerNames ? { formerNames } : {}) })),
      bitsets: { encoding: 'base64', bitOrder: 'least-significant-bit-first',
        rowOrder: 'products', unknown: 'neither-yes-nor-no', columns: indexCells(products, definitions, lifecycleNotices) } },
    facets: definitions,
    products,
    statusLog,
    lifecycleNotices,
    methodology: { schemaVersion: 1, rubricVersion: publication.rubricVersion,
      publisher: publication.publisher, ...methodologyConstants },
  }
}

export const packageFiles = data => new Map([
  ['index.json', data.index], ['facets.json', data.facets],
  ['status-log.json', data.statusLog], ['lifecycle-notices.json', data.lifecycleNotices],
  ['methodology.json', data.methodology],
  ...data.products.map(product => [`products/${product.id}.json`, product]),
])

// `rebuild(generatedAt)` rebuilds the package from the catalog. Without it the
// checks prove only safety and freshness, not that a value came from the builder.
export function checkDirectoryPackage(output = defaultOutput, { date = publicationDate(), rebuild, ...safetyOptions } = {}) {
  const files = new Map()
  const readDirectory = (path, prefix = '') => {
    for (const name of readdirSync(path).sort()) {
      const filename = `${prefix}${name}`
      const absolute = resolve(path, name)
      const stat = lstatSync(absolute)
      if (stat.isDirectory() && filename === 'products') readDirectory(absolute, 'products/')
      else if (stat.isFile() && /^(?:[a-z-]+\.json|products\/[a-z0-9][a-z0-9-]*\.json)$/.test(filename)) {
        const value = readJson(absolute)
        // The scanners read parsed values. Duplicate keys or padding would keep
        // bytes on disk that they never see, so only builder output is accepted.
        if (readFileSync(absolute, 'utf8') !== serialize(value)) throw new Error(`Noncanonical public package file: ${filename}`)
        files.set(filename, value)
      } else throw new Error(`Unexpected public package file: ${filename}`)
    }
  }
  readDirectory(resolve(output))
  const index = files.get('index.json')
  const data = { index, facets: files.get('facets.json'), products: index.products.map(product => files.get(`products/${product.id}.json`)),
    statusLog: files.get('status-log.json'), lifecycleNotices: files.get('lifecycle-notices.json'), methodology: files.get('methodology.json') }
  assertDirectoryShape(data)
  const expected = packageFiles(data)
  if (expected.size !== files.size || [...expected.keys()].some(name => !files.has(name))) {
    throw new Error('Unexpected or missing public package files')
  }
  assertDirectoryFresh(data, date)
  assertPublicationSafe(Object.fromEntries(files), safety({ date, ...safetyOptions }))
  if (rebuild) {
    const rebuilt = packageFiles(rebuild(index.generatedAt))
    for (const [name, value] of files) if (serialize(value) !== serialize(rebuilt.get(name))) {
      throw new Error(`Public package differs from the catalog in ${name}; rebuild instead of editing it`)
    }
  }
  return data
}

export function writeDirectoryPackage(data, output = defaultOutput, safetyOptions = {}) {
  assertDirectoryShape(data)
  const files = packageFiles(data)
  for (const name of files.keys()) if (!/^(?:[a-z-]+\.json|products\/[a-z0-9][a-z0-9-]*\.json)$/.test(name)) {
    throw new Error('Unsafe public package filename')
  }
  const scan = safety({ date: data.index.generatedAt, ...safetyOptions })
  assertPublicationSafe(Object.fromEntries(files), scan)
  const target = resolve(output)
  const staging = `${target}.staging-${process.pid}`
  const previous = `${target}.previous-${process.pid}`
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  try {
    for (const [name, value] of files) {
      const path = resolve(staging, name)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, serialize(value))
    }
    // Rescan what reached the disk. Escaped JSON must not bypass the check.
    assertPublicationSafe(Object.fromEntries([...files.keys()].map(name => [name, readJson(resolve(staging, name))])), scan)
    rmSync(previous, { recursive: true, force: true })
    try { renameSync(target, previous) } catch (error) { if (error.code !== 'ENOENT') throw error }
    try { renameSync(staging, target) } catch (error) {
      try { renameSync(previous, target) } catch { /* No prior package existed. */ }
      throw error
    }
    rmSync(previous, { recursive: true, force: true })
  } finally { rmSync(staging, { recursive: true, force: true }) }
  return files.size
}

const buildFromCatalog = date => buildDirectoryFromPublication(buildPublication({ date, format: 'products', directory: true }),
  { mappings: loadFacetMappings() })

export function buildDirectory({ date = publicationDate(), output = defaultOutput } = {}) {
  const data = buildFromCatalog(date)
  writeDirectoryPackage(data, output)
  return data
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node directory/build.mjs [--check]')
  const checking = process.argv.includes('--check')
  const data = checking ? checkDirectoryPackage(defaultOutput, { rebuild: buildFromCatalog }) : buildDirectory()
  console.log(`Public directory ${checking ? 'checked' : 'built'}: ${data.products.length} products, ${data.facets.facets.length} facets, ${defaultOutput}`)
}
