import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { claimReviewHash, createUnknownProfile, lifecycleReviewHash } from '../lib.mjs'
import { buildPublication, buildPublicationFromProfiles, publicationConfig, publicationDate, publicationDateOverride, publicationDateVariables } from './build.mjs'
import { assertPublicationSafe } from './security.mjs'
import { buildDirectoryFromPublication, checkDirectoryPackage, facetVocabulary, loadFacetDefinitions, loadFacetMappings, packageFiles, publicFormerNames, writeDirectoryPackage } from '../directory/build.mjs'
import { facetReviewHash, productFacets, publicFacet, validateDefinitions } from '../directory/facets.mjs'
import { assertDirectoryShape } from '../directory/security.mjs'
import { validatePackage } from '../../scripts/validate-data.mjs'

// Synthetic fixtures stay fixed; real catalog checks follow the package snapshot.
const date = '2026-11-07'
const packageDate = publicationDateOverride()[1]
  ? publicationDate()
  : JSON.parse(readFileSync(new URL('../../data/index.json', import.meta.url), 'utf8')).generatedAt
const checkedAt = '2026-11-01'
const due = '2026-11-21'
const definitions = loadFacetDefinitions()
const definition = id => definitions.facets.find(facet => facet.id === id)
const knownCells = product => Object.values(product.facets).flatMap(value => value.value ? [value] : Object.values(value))

// These mapping tests model an independently rechecked catalog finding. The old
// facet digest must still expire after that source or claim review is replaced.
const recordFixtureClaimReviews = profile => {
  for (const claim of profile.claims) {
    if (claim.publication !== 'public-reviewed') claim.review = null
    else if (claim.review) claim.review.contentHash = claimReviewHash(profile, claim)
  }
}

function fixture() {
  const profiles = ['tool', 'other'].map(id => createUnknownProfile({ id, name: id,
    identity: { website: `https://${id}.example.com` },
    surfaces: [{ id: 'desktop', name: 'Local desktop', type: 'desktop' }],
  }, { date: checkedAt, researcher: 'PRIVATE-RESEARCHER' }))
  const profile = profiles[0]
  for (const criterion of ['ACC-01', 'RUN-01', 'RUN-02', 'OWN-01']) {
    const evidenceId = criterion.toLowerCase()
    profile.evidence.push({ id: evidenceId, kind: 'documented', url: `https://tool.example.com/${evidenceId}`,
      title: 'Public documentation', locator: criterion, sourceDate: null, retrievedAt: checkedAt,
      finding: 'Public source finding, summarized rather than quoted.', visibility: 'public', commit: null, path: null })
    const claim = profile.claims.find(item => item.criterionId === criterion)
    Object.assign(claim, { answer: 'Public finding scoped to the local application.', support: 'supported',
      availability: 'generally-available', delivery: 'native', checkedAt, nextReviewAt: due,
      evidenceIds: [evidenceId], publication: 'public-reviewed',
      review: { reviewer: 'PRIVATE-CLAIM-REVIEWER', date: checkedAt } })
    claim.scope.surfaceIds = ['desktop']
    claim.review.contentHash = claimReviewHash(profile, claim)
  }
  const hidden = profile.claims.find(item => item.criterionId === 'ACC-02')
  hidden.answer = 'PRIVATE-INTERNAL-ANSWER-6d9b36'
  profile.evidence.push({ id: 'private', kind: 'documented', url: 'internal-file:secret/notes',
    title: 'PRIVATE-INTERNAL-TITLE-a2239b', locator: 'PRIVATE-INTERNAL-LOCATOR-613c', sourceDate: null,
    retrievedAt: checkedAt, finding: 'PRIVATE-INTERNAL-EVIDENCE-e405cc', visibility: 'internal', commit: null, path: null })
  profile.changes = [{ date: checkedAt, author: 'PRIVATE-CHANGE-AUTHOR', type: 'product-change',
    summary: 'PRIVATE-CHANGE-SUMMARY-df5715', claimIds: ['tool:RUN-01', hidden.id],
    evidenceIds: ['run-01', 'private'], before: { answer: 'PRIVATE-BEFORE' }, after: { answer: 'PRIVATE-AFTER' } }]
  const registry = [{ id: 'tool', name: 'tool', sources: ['https://tool.example.com'], scopeNote: 'PRIVATE-REGISTER-NOTE-d172b0', category: 'A' },
    { id: 'listing', name: 'Listing only', sources: ['https://listing.example.com'], scopeNote: 'PRIVATE-LEAD-NOTE-6642e4', origin: 'private-lead' }]
  const publish = buildDate => buildPublicationFromProfiles(profiles, { date: buildDate ?? date, format: 'products', registry })
  const publication = publish()
  const product = publication.products.find(product => product.id === 'tool')
  const mappings = { tool: {} }
  for (const [facetId, option, value, criterion] of [
    ['cli', null, 'yes', 'ACC-01'], ['execution', 'local', 'yes', 'RUN-01'],
    ['isolation', 'worktree', 'yes', 'RUN-02'], ['license', null, 'mit', 'OWN-01'],
  ]) {
    const entry = { value, claimId: `tool:${criterion}`, evidenceIds: [`tool:${criterion.toLowerCase()}`],
      checkedAt: date, researcher: 'PRIVATE-FACET-RESEARCHER', rationale: 'Typed from the scoped public finding.',
      contentHash: null, review: null }
    entry.contentHash = facetReviewHash(product, facetId, option, entry, definition(facetId))
    if (option) (mappings.tool[facetId] ??= {})[option] = entry
    else mappings.tool[facetId] = entry
  }
  const data = () => buildDirectoryFromPublication(publish(), { mappings })
  return { profiles, profile, registry, mappings, publish, publication, product, data }
}

test('defines 26 typed filters without a false unknown/no equivalence', () => {
  validateDefinitions(definitions)
  assert.equal(definitions.facets.length, 26)
  assert.deepEqual(definitions.booleanValues, ['yes', 'no', 'unknown'])
  for (const mutate of [
    copy => copy.facets.push(copy.facets[0]),
    copy => copy.facets[0].options.push(copy.facets[0].options[0]),
    copy => copy.facets[0].type = 'text',
  ]) {
    const copy = structuredClone(definitions)
    mutate(copy)
    assert.throws(() => validateDefinitions(copy))
  }
})

test('products format applies publication gates without constructing pair pages', () => {
  const { publication } = fixture()
  assert.equal(publication.pairs, undefined)
  assert.equal(publication.products.length, 2)
  assert.equal(publication.products.find(p => p.id === 'tool').claims.length, 4)
  assert.equal(publication.products.find(p => p.id === 'other').claims.length, 0)
  assert.ok(publication.products.find(p => p.id === 'tool').sources.every(source => source.id.startsWith('tool:')))
  assert.equal(JSON.stringify(publication).includes('PRIVATE-'), false)
  assert.deepEqual(publication.listings[1], { id: 'listing', name: 'Listing only', website: 'https://listing.example.com' })
})

test('copyleft options survive both package allowlists with distinct version grants', () => {
  const options = ['gpl-3-0', 'gpl-3-0-or-later', 'agpl-3-0', 'agpl-3-0-or-later']
  const license = definition('license')
  assert.equal(license.multiple, false)
  assert.deepEqual(license.options.filter(option => /^(?:a?gpl)-/.test(option.id)).map(option => option.id), options)
  for (const value of options) {
    const f = fixture()
    const entry = f.mappings.tool.license
    entry.value = value
    entry.contentHash = facetReviewHash(f.product, 'license', null, entry, license)
    const data = f.data()
    const row = data.index.products.findIndex(p => p.id === 'tool')
    const bit = value => Boolean(Buffer.from(value, 'base64')[row >> 3] & (1 << (row & 7)))
    const cell = data.products[row].facets.license
    assert.equal(cell.value, value)
    assert.equal(cell.verificationStatus, 'sourced')
    assert.equal(cell.crossCheckedAt, null)
    for (const option of license.options) {
      const column = data.index.bitsets.columns[`license:${option.id}`]
      assert.equal(bit(column.yes), option.id === value)
      assert.equal(bit(column.no), option.id !== value)
      assert.equal(bit(column.crossChecked), false)
    }
    assertDirectoryShape(data)
    assertPublicationSafe(Object.fromEntries(packageFiles(data)), { date, profiles: f.profiles,
      registry: f.registry, privateRecords: Object.values(f.mappings), vocabulary: facetVocabulary(definitions) })
    assert.equal(validatePackage({ index: data.index, definitions: data.facets, products: data.products,
      notices: data.lifecycleNotices, status: data.statusLog, methodology: data.methodology }, date), true)
  }
})

test('license definition changes invalidate existing values and their independent reviews', () => {
  const f = fixture()
  const entry = f.mappings.tool.license
  entry.review = { state: 'accepted', reviewer: 'PRIVATE-FACET-REVIEWER', date, contentHash: entry.contentHash }
  assert.equal(publicFacet(f.product, definition('license'), null, entry, date).verificationStatus, 'agent-cross-checked')
  const revised = structuredClone(definition('license'))
  revised.options.push({ id: 'new-license', label: 'New license' })
  assert.equal(publicFacet(f.product, revised, null, entry, date).value, 'unknown')
  entry.contentHash = facetReviewHash(f.product, 'license', null, entry, revised)
  const rebound = publicFacet(f.product, revised, null, entry, date)
  assert.equal(rebound.value, 'mit')
  assert.equal(rebound.verificationStatus, 'sourced')
  assert.equal(rebound.crossCheckedAt, null)
})

test('claim cross-checks alone never cross-check typed facet mappings', () => {
  const f = fixture()
  const cell = f.data().products.find(p => p.id === 'tool').facets.cli
  assert.equal(cell.value, 'yes')
  assert.equal(cell.verificationStatus, 'sourced')
  assert.equal(cell.crossCheckedAt, null)
  const entry = f.mappings.tool.cli
  entry.review = { state: 'accepted', reviewer: 'PRIVATE-FACET-REVIEWER', date, contentHash: entry.contentHash }
  const checked = f.data().products.find(p => p.id === 'tool').facets.cli
  assert.equal(checked.verificationStatus, 'agent-cross-checked')
  assert.equal(checked.crossCheckedAt, date)
  assert.equal(JSON.stringify(checked).includes('PRIVATE-'), false)
  assert.equal(JSON.stringify(checked).includes('contentHash'), false)
  for (const mutate of [
    review => delete review.state,
    review => review.reviewer = 'private-facet-researcher ', review => review.reviewer = '',
    review => review.date = '2026-11-08', review => review.date = '2026-10-31',
    review => review.contentHash = 'old-hash',
  ]) {
    entry.review = { state: 'accepted', reviewer: 'PRIVATE-FACET-REVIEWER', date, contentHash: entry.contentHash }
    mutate(entry.review)
    assert.equal(f.data().products.find(p => p.id === 'tool').facets.cli.verificationStatus, 'sourced')
  }
})

test('former names require an eligible rename finding and its own current citations', () => {
  const f = fixture()
  const claim = f.profile.claims.find(claim => claim.criterionId === 'ACC-01')
  claim.answer = 'tool, formerly Old Tool, has a local desktop application.'
  f.profile.identity.aliases = ['PRIVATE-ALIAS']
  recordFixtureClaimReviews(f.profile)
  const formerNames = { tool: [{ name: 'Old Tool', claimId: claim.id, evidenceIds: ['tool:acc-01'] }] }
  const build = publication => buildDirectoryFromPublication(publication, { mappings: f.mappings, formerNames })
  const data = build(f.publish())
  assert.deepEqual(data.index.products.find(product => product.id === 'tool').formerNames, ['Old Tool'])
  assert.deepEqual(data.products.find(product => product.id === 'tool').formerNames, ['Old Tool'])
  assert.equal(JSON.stringify(data).includes('PRIVATE-ALIAS'), false)
  assertDirectoryShape(data)
  const forged = structuredClone(data)
  forged.products.find(product => product.id === 'tool').formerNames = ['Unrelated Tool']
  forged.index.products.find(product => product.id === 'tool').formerNames = ['Unrelated Tool']
  assert.throws(() => assertDirectoryShape(forged), /no rename finding/)
  for (const patch of [
    { name: 'PRIVATE-ALIAS' }, { claimId: 'tool:RUN-01' }, { evidenceIds: ['tool:run-01'] },
    { evidenceIds: ['other:acc-01'] }, { evidenceIds: [] },
  ]) assert.deepEqual(publicFormerNames(data.products.find(product => product.id === 'tool'), [{ ...formerNames.tool[0], ...patch }]), [])
  assert.equal(build(f.publish('2026-11-22')).products.find(product => product.id === 'tool').formerNames, undefined)
})

test('scoped former names require a cited product surface and reject unrelated names', () => {
  const f = fixture()
  const claim = f.profile.claims.find(claim => claim.criterionId === 'ACC-01')
  f.profile.surfaces[0].name = 'tool Desktop, formerly Old Desktop'
  claim.answer = 'tool Desktop, formerly Old Desktop, is the local editor. Another App, formerly Other Name, is separate.'
  recordFixtureClaimReviews(f.profile)
  const publication = f.publish()
  const product = publication.products.find(product => product.id === 'tool')
  const entry = { name: 'Old Desktop', surface: 'tool Desktop', claimId: claim.id, evidenceIds: ['tool:acc-01'] }
  const data = buildDirectoryFromPublication(publication, { mappings: f.mappings, formerNames: { tool: [entry] } })
  assert.deepEqual(data.index.products.find(product => product.id === 'tool').formerNames, ['Old Desktop'])
  assert.deepEqual(data.products.find(product => product.id === 'tool').formerNames, ['Old Desktop'])
  assertDirectoryShape(data)
  const sitePackage = data => ({ index: data.index, definitions: data.facets, products: data.products,
    notices: data.lifecycleNotices, status: data.statusLog, methodology: data.methodology })
  assert.equal(validatePackage(sitePackage(data), date), true)
  assert.deepEqual(publicFormerNames(product, [{ ...entry, surface: undefined }]), [])
  assert.deepEqual(publicFormerNames(product, [{ ...entry, evidenceIds: ['tool:run-01'] }]), [])
  assert.deepEqual(publicFormerNames(product, [{ ...entry, name: 'Other Name', surface: 'Another App' }]), [])
  const forged = structuredClone(data)
  forged.products.find(product => product.id === 'tool').formerNames = ['Other Name']
  forged.index.products.find(product => product.id === 'tool').formerNames = ['Other Name']
  assert.throws(() => assertDirectoryShape(forged), /no rename finding/)
  assert.throws(() => validatePackage(sitePackage(forged), date), /no rename finding/)
})

test('a rejected mapping leaves the public package until a revision changes its digest', () => {
  const f = fixture()
  const entry = f.mappings.tool.cli
  entry.review = { state: 'changes-requested', reviewer: 'PRIVATE-FACET-REVIEWER', date, contentHash: entry.contentHash }
  assert.equal(f.data().products.find(p => p.id === 'tool').facets.cli.value, 'unknown')
  entry.rationale = 'Revised after the review.'
  entry.contentHash = facetReviewHash(f.product, 'cli', null, entry, definition('cli'))
  const revised = f.data().products.find(p => p.id === 'tool').facets.cli
  assert.equal(revised.value, 'yes')
  assert.equal(revised.verificationStatus, 'sourced')
})

test('candidate source findings keep facets sourced even with a separate mapping review', () => {
  const f = fixture()
  const claim = f.profile.claims.find(c => c.id === f.mappings.tool.cli.claimId)
  claim.publication = 'public-candidate'
  claim.review = null
  const product = f.publish().products.find(p => p.id === 'tool')
  const entry = f.mappings.tool.cli
  entry.contentHash = facetReviewHash(product, 'cli', null, entry, definition('cli'))
  entry.review = { state: 'accepted', reviewer: 'PRIVATE-FACET-REVIEWER', date, contentHash: entry.contentHash }
  assert.equal(publicFacet(product, definition('cli'), null, entry, date).verificationStatus, 'sourced')
})

test('evidence, finding, definition and mapping edits invalidate the digest', () => {
  for (const mutate of [
    f => f.profile.evidence[0].finding = 'Changed source finding.',
    f => f.profile.evidence[0].url = 'https://changed.example.com',
    f => f.profile.evidence[0].locator = 'Changed locator',
    f => f.profile.evidence[0].retrievedAt = '2026-11-02',
    f => f.profile.claims[0].answer = 'Changed scoped finding.',
    f => f.profile.claims[0].scope.plan = 'Enterprise',
    f => f.mappings.tool.cli.value = 'no',
    f => f.mappings.tool.cli.researcher = 'CHANGED-RESEARCHER',
    f => f.mappings.tool.cli.rationale = 'Changed mapping basis.',
  ]) {
    const f = fixture()
    mutate(f)
    recordFixtureClaimReviews(f.profile)
    assert.equal(f.data().products.find(p => p.id === 'tool').facets.cli.value, 'unknown')
  }
  const f = fixture()
  const changed = structuredClone(definition('cli'))
  changed.description = 'Different meaning for this requirement.'
  assert.equal(publicFacet(f.product, changed, null, f.mappings.tool.cli, date).value, 'unknown')
  const reordered = Object.fromEntries(Object.entries(f.mappings.tool.cli).reverse())
  assert.equal(facetReviewHash(f.product, 'cli', null, reordered, definition('cli')), f.mappings.tool.cli.contentHash)
})

test('the default publication contract still expires findings and leaves source dates unchanged', () => {
  const f = fixture()
  const onDue = buildDirectoryFromPublication(f.publish(due), { mappings: f.mappings })
  assert.equal(onDue.products.find(p => p.id === 'tool').facets.cli.value, 'yes')
  const expired = buildDirectoryFromPublication(f.publish('2026-11-22'), { mappings: f.mappings })
  const product = expired.products.find(p => p.id === 'tool')
  assert.ok(knownCells(product).every(cell => cell.value === 'unknown'))
  assert.equal(product.sources.length, 0)
  assert.equal(product.claims.length, 0)
  assert.equal(expired.statusLog.length, 0)
  assert.equal(f.profile.claims[0].nextReviewAt, due)
  assert.equal(f.mappings.tool.cli.checkedAt, date)
})

test('ineligible findings and unrelated citations cannot support a facet', () => {
  for (const mutate of [
    f => { f.profile.claims[0].publication = 'internal-only' },
    f => { f.profile.claims[0].publication = 'public-candidate'; f.profile.claims[0].contradictions = ['Conflict'] },
    f => { f.profile.claims[0].publication = 'public-candidate'; f.profile.claims[0].scope.surfaceIds = [] },
    f => { f.profile.claims[0].publication = 'public-candidate'; f.profile.evidence[0].visibility = 'internal' },
    f => { f.profile.claims[0].availability = 'announced' },
    f => { f.mappings.tool.cli.evidenceIds = ['tool:run-01'] },
    f => { f.mappings.tool.cli.evidenceIds = ['other:acc-01'] },
    f => { f.mappings.tool.cli.checkedAt = '2026-11-08' },
    f => { f.mappings.tool.cli.checkedAt = '2026-10-31' },
    f => { f.mappings.tool.cli.evidenceIds = [] },
  ]) {
    const f = fixture()
    mutate(f)
    recordFixtureClaimReviews(f.profile)
    assert.equal(f.data().products.find(p => p.id === 'tool').facets.cli.value, 'unknown')
  }
})

test('the reserved lifecycle claim cannot support a capability mapping', () => {
  const f = fixture()
  f.profile.evidence.push({ id: 'sunset', kind: 'documented', url: 'https://tool.example.com/sunset', title: 'Service transition',
    locator: 'Dates', sourceDate: checkedAt, retrievedAt: checkedAt, finding: 'The hosted service is sunsetting.', visibility: 'public', commit: null, path: null })
  f.profile.lifecycle = { status: 'sunset', note: 'Hosted service is sunsetting.', scope: 'Hosted service only',
    continuation: null, announcementDate: checkedAt, serviceEndDate: null, checkedAt, nextReviewAt: due, evidenceIds: ['sunset'],
    researcher: 'PRIVATE-LIFECYCLE-RESEARCHER', publication: 'public-reviewed', contradictions: [], review: null }
  f.profile.lifecycle.review = { reviewer: 'PRIVATE-LIFECYCLE-REVIEWER', date: checkedAt, contentHash: lifecycleReviewHash(f.profile) }
  const product = f.publish().products.find(p => p.id === 'tool')
  const entry = { ...f.mappings.tool.cli, value: 'no', claimId: 'tool:lifecycle', evidenceIds: ['tool:sunset'] }
  entry.contentHash = facetReviewHash(product, 'cli', null, entry, definition('cli'))
  assert.equal(publicFacet(product, definition('cli'), null, entry, date).value, 'unknown')
})

test('a finding must be able to support the mapped value', () => {
  const remap = (f, value) => {
    recordFixtureClaimReviews(f.profile)
    const product = f.publish().products.find(p => p.id === 'tool')
    const entry = { ...f.mappings.tool.cli, value }
    entry.contentHash = facetReviewHash(product, 'cli', null, entry, definition('cli'))
    return publicFacet(product, definition('cli'), null, entry, date).value
  }
  for (const [availability, value, expected] of [['removed', 'yes', 'unknown'], ['removed', 'no', 'no'],
    ['private-preview', 'yes', 'unknown'], ['beta', 'yes', 'yes'], ['announced', 'no', 'unknown']]) {
    const f = fixture()
    Object.assign(f.profile.claims[0], { availability, support: value === 'no' ? 'unsupported' : 'supported' })
    assert.equal(remap(f, value), expected, `${availability} ${value}`)
  }
  for (const [support, value, expected] of [['unsupported', 'yes', 'unknown'], ['supported', 'no', 'unknown'], ['unsupported', 'no', 'no']]) {
    const f = fixture()
    f.profile.claims[0].support = support
    assert.equal(remap(f, value), expected, `${support} ${value}`)
  }
})

test('a recheck cannot freshen a mapping whose own citation was not reread', () => {
  const f = fixture()
  const claim = f.profile.claims[0]
  claim.evidenceIds.push('run-01')
  claim.checkedAt = '2026-11-03'
  claim.review.date = '2026-11-03'
  f.profile.evidence.find(item => item.id === 'run-01').retrievedAt = '2026-11-03'
  recordFixtureClaimReviews(f.profile)
  const product = f.publish().products.find(p => p.id === 'tool')
  assert.equal(product.claims.some(item => item.claimId === claim.id), true)
  const entry = f.mappings.tool.cli
  entry.contentHash = facetReviewHash(product, 'cli', null, entry, definition('cli'))
  assert.equal(publicFacet(product, definition('cli'), null, entry, date).value, 'unknown')
  entry.evidenceIds = ['tool:run-01']
  entry.contentHash = facetReviewHash(product, 'cli', null, entry, definition('cli'))
  assert.equal(publicFacet(product, definition('cli'), null, entry, date).value, 'yes')
})

test('unknown and explicit no use different compact index bits', () => {
  const f = fixture()
  const entry = f.mappings.tool.cli
  f.profile.claims.find(claim => claim.id === entry.claimId).support = 'unsupported'
  recordFixtureClaimReviews(f.profile)
  entry.value = 'no'
  const product = f.publish().products.find(p => p.id === 'tool')
  entry.contentHash = facetReviewHash(product, 'cli', null, entry, definition('cli'))
  f.mappings.tool.license.value = 'mit'
  for (const [id, record] of [['execution', f.mappings.tool.execution.local], ['isolation', f.mappings.tool.isolation.worktree], ['license', f.mappings.tool.license]]) {
    record.contentHash = facetReviewHash(product, id, id === 'license' ? null : id === 'execution' ? 'local' : 'worktree', record, definition(id))
  }
  const data = f.data()
  const toolIndex = data.index.products.findIndex(p => p.id === 'tool')
  const bits = data.index.bitsets.columns.cli
  const bit = (value, i) => Boolean(Buffer.from(value, 'base64')[i >> 3] & (1 << (i & 7)))
  assert.equal(bit(bits.yes, toolIndex), false)
  assert.equal(bit(bits.no, toolIndex), true)
  for (let i = 0; i < data.index.products.length; i++) if (i !== toolIndex) {
    assert.equal(bit(bits.yes, i), false)
    assert.equal(bit(bits.no, i), false)
  }
  assert.equal(bit(data.index.bitsets.columns['license:mit'].yes, toolIndex), true)
  assert.equal(bit(data.index.bitsets.columns['license:proprietary'].no, toolIndex), true)
})

test('register names outside the covered set are identity-only listings', () => {
  const f = fixture()
  const data = f.data()
  for (const product of data.products.filter(p => p.id !== 'tool')) {
    assert.deepEqual(Object.keys(product).sort(), ['id', 'name', 'researchStatus', 'website'])
    assert.equal(product.researchStatus, 'not-researched')
  }
  assert.equal(data.methodology.publisher.disclosure, publicationConfig.publisher.disclosure)
  assert.equal(data.methodology.ranking.overallScore, false)
  assert.equal(data.methodology.ranking.publisherPlacementAdvantage, false)
  assert.deepEqual(data.methodology.freshnessDays, { priceAndAvailability: 60, capability: 120, stableArchitectureAndLicense: 180 })
})

test('the same mapping contract accepts products beyond the initial coverage cohort', () => {
  const f = fixture()
  f.mappings.other = {}
  const product = f.data().products.find(p => p.id === 'other')
  assert.equal(product.researchStatus, 'covered')
  assert.ok(knownCells(product).every(cell => cell.value === 'unknown'))
  assert.equal(product.claims.length, 0)
})

test('the on-disk index cannot hide data or treat an unknown listing as no', () => {
  const f = fixture()
  const encoded = f.data()
  encoded.index.bitsets.columns.cli.yes = Buffer.from('PRIVATE-ENCODED-CONTENT').toString('base64')
  assert.throws(() => assertDirectoryShape(encoded), /Invalid public bitset/)
  const negative = f.data()
  const index = negative.index.products.findIndex(p => p.id === 'listing')
  const bytes = Buffer.from(negative.index.bitsets.columns.cli.no, 'base64')
  bytes[index >> 3] |= 1 << (index & 7)
  negative.index.bitsets.columns.cli.no = bytes.toString('base64')
  assert.throws(() => assertDirectoryShape(negative), /bitset differs from receipt/)
})

test('status events retain only gated references and never private history prose', () => {
  const f = fixture()
  const [event] = f.data().statusLog
  assert.deepEqual(Object.keys(event).sort(), ['claimIds', 'date', 'evidenceIds', 'id', 'productId', 'type'])
  assert.deepEqual(event.claimIds, ['tool:RUN-01'])
  assert.deepEqual(event.evidenceIds, ['tool:run-01'])
  assert.equal(JSON.stringify(event).includes('PRIVATE-'), false)
  f.profile.changes[0].date = '2026-11-08'
  assert.equal(f.data().statusLog.length, 0)
})

test('lifecycle facets, notices and exclusive citations use the independent lifecycle gate', () => {
  const f = fixture()
  f.profile.evidence.push({ id: 'sunset', kind: 'documented', url: 'https://tool.example.com/sunset', title: 'Service transition',
    locator: 'Hosted service dates', sourceDate: checkedAt, retrievedAt: checkedAt,
    finding: 'The hosted service is sunsetting; the local application continues.', visibility: 'public', commit: null, path: null })
  f.profile.lifecycle = { status: 'sunset', note: 'Hosted service is sunsetting.', scope: 'Hosted service only',
    continuation: 'The local application continues.', announcementDate: checkedAt, serviceEndDate: null,
    checkedAt, nextReviewAt: due, evidenceIds: ['sunset'], researcher: 'PRIVATE-LIFECYCLE-RESEARCHER',
    publication: 'public-reviewed', contradictions: [], review: null }
  f.profile.lifecycle.review = { reviewer: 'PRIVATE-LIFECYCLE-REVIEWER', date: checkedAt, contentHash: lifecycleReviewHash(f.profile) }
  f.profile.changes.push({ date: checkedAt, author: 'PRIVATE-CHANGE-AUTHOR', type: 'product-change', summary: 'PRIVATE-SUNSET-HISTORY',
    claimIds: [], evidenceIds: ['sunset'], before: null, after: f.profile.lifecycle })
  const data = f.data()
  assert.equal(data.lifecycleNotices[0].scope, 'Hosted service only')
  assert.equal(data.products.find(p => p.id === 'tool').facets['lifecycle-status'].value, 'sunset')
  assert.equal(data.products.find(p => p.id === 'tool').facets['lifecycle-status'].verificationStatus, 'agent-cross-checked')
  assert.equal(data.products.find(p => p.id === 'tool').sources.at(-1).id, 'tool:sunset')
  assert.equal(data.statusLog.length, 2)
  const plain = f.profiles[1]
  plain.evidence.push({ ...f.profile.evidence.at(-1), id: 'sunset' })
  plain.lifecycle = structuredClone(f.profile.lifecycle)
  plain.lifecycle.review.contentHash = lifecycleReviewHash(plain)
  const withPlainNotice = f.data()
  assert.equal(withPlainNotice.lifecycleNotices.length, 2)
  assert.equal(withPlainNotice.lifecycleNotices.find(n => n.productId === 'other').sources[0].id, 'other:sunset')
  assert.deepEqual(Object.keys(withPlainNotice.products.find(p => p.id === 'other')).sort(), ['id', 'name', 'researchStatus', 'website'])
  const row = withPlainNotice.index.products.findIndex(p => p.id === 'other')
  const bits = Buffer.from(withPlainNotice.index.bitsets.columns['lifecycle-status:sunset'].yes, 'base64')
  assert.ok(bits[row >> 3] & (1 << (row & 7)))
  assertDirectoryShape(withPlainNotice)
  f.profile.lifecycle.publication = 'public-candidate'
  f.profile.lifecycle.review = null
  const withheld = f.data()
  assert.equal(withheld.lifecycleNotices.length, 1)
  assert.equal(withheld.lifecycleNotices[0].productId, 'other')
  assert.equal(withheld.products.find(p => p.id === 'tool').facets['lifecycle-status'].value, 'unknown')
  assert.equal(withheld.products.find(p => p.id === 'tool').sources.some(s => s.id === 'tool:sunset'), false)
  assert.equal(withheld.statusLog.length, 1)
})

test('privacy scanner blocks private keys, file URLs, internal text and identities', () => {
  const f = fixture()
  const safety = { date, profiles: f.profiles, registry: f.registry, privateRecords: Object.values(f.mappings) }
  assertPublicationSafe(Object.fromEntries(packageFiles(f.data())), safety)
  for (const field of ['researcher', 'reviewer', 'author', 'publication', 'scopeNote', 'context', 'review', 'contentHash', 'before', 'after', 'visibility']) {
    assert.throws(() => assertPublicationSafe({ [field]: 'value' }, safety), /Private field/)
  }
  for (const text of ['internal-file:catalog/secret', 'file:///tmp/secret', 'https://machine.tail0000.ts.net/files/asset?path=secret',
    'PRIVATE-INTERNAL-ANSWER-6d9b36', 'PRIVATE-INTERNAL-EVIDENCE-e405cc', 'PRIVATE-REGISTER-NOTE-d172b0', 'PRIVATE-CHANGE-SUMMARY-df5715',
    'PRIVATE-RESEARCHER', 'PRIVATE-CLAIM-REVIEWER', 'PRIVATE-FACET-RESEARCHER', 'PRIVATE-CHANGE-AUTHOR']) {
    assert.throws(() => assertPublicationSafe({ answer: `Text ${text} more text` }, safety), /Internal|Private/)
  }
  const injected = f.data()
  injected.products[0].privateNotes = 'Any new private key must also fail.'
  assert.throws(() => assertDirectoryShape(injected), /Unexpected public field/)
  const nested = f.data()
  nested.products[0].name = { newPrivateField: 'An object hidden in a text field.' }
  assert.throws(() => assertDirectoryShape(nested), /Expected string/)
  f.profile.claims.find(c => c.criterionId === 'ACC-02').answer = 'S3CR3T'
  assert.throws(() => assertPublicationSafe({ answer: 'S3CR3T' }, safety), /Internal-only text/)
})

test('text outside the approved output fails, including expired and unreviewed candidates', () => {
  const f = fixture()
  f.mappings.tool.cli.review = { state: 'changes-requested', reviewer: 'PRIVATE-FACET-REVIEWER', date,
    contentHash: f.mappings.tool.cli.contentHash, note: 'PRIVATE-REVIEW-NOTE-g7' }
  const safety = { date, profiles: f.profiles, registry: f.registry, privateRecords: Object.values(f.mappings) }
  assert.throws(() => assertPublicationSafe({ answer: 'PRIVATE-REVIEW-NOTE-g7' }, safety), /Internal-only text/)
  const candidate = f.profile.claims.find(c => c.criterionId === 'ACC-03')
  Object.assign(candidate, { answer: 'CONTRADICTED-CANDIDATE-ANSWER-a1', support: 'supported', evidenceIds: ['acc-01'], publication: 'public-candidate',
    contradictions: ['CONFLICT-NOTE-b2'], checkedAt, nextReviewAt: due })
  candidate.scope.surfaceIds = ['desktop']
  const expired = f.profile.claims.find(c => c.criterionId === 'ACC-04')
  Object.assign(expired, { answer: 'EXPIRED-ANSWER-c3', support: 'supported', evidenceIds: ['acc-01'], publication: 'public-reviewed',
    checkedAt: '2026-10-01', nextReviewAt: '2026-10-15', review: { reviewer: 'PRIVATE-CLAIM-REVIEWER', date: '2026-10-01' } })
  expired.scope.surfaceIds = ['desktop']
  recordFixtureClaimReviews(f.profile)
  f.profile.evidence.push({ id: 'uncited', kind: 'documented', url: 'https://tool.example.com/uncited', title: 'UNCITED-TITLE-d4',
    locator: 'Page', sourceDate: null, retrievedAt: checkedAt, finding: 'UNCITED-FINDING-e5', visibility: 'public', commit: null, path: null })
  f.profile.lifecycle = { status: 'sunset', note: 'CANDIDATE-LIFECYCLE-NOTE-f6', scope: 'Hosted', continuation: null, announcementDate: null,
    serviceEndDate: null, checkedAt, nextReviewAt: due, evidenceIds: ['acc-01'], researcher: 'PRIVATE-LIFECYCLE-RESEARCHER',
    publication: 'public-candidate', contradictions: [], review: null }
  for (const text of ['CONTRADICTED-CANDIDATE-ANSWER-a1', 'CONFLICT-NOTE-b2', 'EXPIRED-ANSWER-c3', 'UNCITED-TITLE-d4', 'UNCITED-FINDING-e5', 'CANDIDATE-LIFECYCLE-NOTE-f6']) {
    assert.throws(() => assertPublicationSafe({ answer: text }, safety), /Internal-only text/, text)
    assert.throws(() => assertPublicationSafe({ answer: `Before ${text} after.` }, safety), /Internal-only text/, text)
  }
  assert.throws(() => assertPublicationSafe({ answer: 'conflict\u200b-note-b2' }, safety), /Internal-only text/)
})

test('filter definitions get no blanket pass from the private text scan', () => {
  const f = fixture()
  const safety = { date, profiles: f.profiles, registry: f.registry, privateRecords: Object.values(f.mappings) }
  const secret = 'PRIVATE-INTERNAL-ANSWER-6d9b36'
  const leaked = structuredClone(definitions)
  leaked.facets[0].description = `A shipped desktop client. ${secret}`
  assert.throws(() => assertPublicationSafe({ 'facets.json': leaked }, safety), /Internal-only text/)
  f.profile.claims.find(c => c.criterionId === 'ACC-02').answer = definitions.facets[0].description
  assert.throws(() => assertPublicationSafe({ answer: definitions.facets[0].description }, safety), /Internal-only text/)
})

test('structural values in private history never count as private text', () => {
  const f = fixture()
  f.profile.changes.push({ date: checkedAt, author: 'PRIVATE-CHANGE-AUTHOR', type: 'product-change', summary: 'Moved.', claimIds: [],
    evidenceIds: ['acc-01'], before: { lifecycle: { status: 'unknown' } },
    after: { lifecycle: { status: 'sunset' }, retrievedAt: '2026-11-02', publication: 'public-reviewed', evidenceIds: ['acc-01'], url: 'https://tool.example.com/plain' } })
  const safety = { date, profiles: f.profiles, registry: f.registry, privateRecords: Object.values(f.mappings) }
  assertPublicationSafe({ value: 'sunset', checkedAt: '2026-11-02', status: 'public-reviewed', evidence: 'acc-01',
    text: 'A fully sunset product, last seen 2026-11-02 at https://tool.example.com/plain/page.' }, safety)
})

test('non-public URLs and internal paths fail even inside approved-looking text', () => {
  const f = fixture()
  const safety = { date, profiles: f.profiles, registry: f.registry, privateRecords: Object.values(f.mappings) }
  for (const text of ['/Users/someone/secret', 'C:\\Users\\someone\\secret', 'repo/.worktrees/issue-1/file', '/home/someone/repo/file', 'https://box.example-net.ts.net/x']) {
    assert.throws(() => assertPublicationSafe({ finding: text }, safety), /Internal URL/, text)
  }
  for (const url of ['http://localhost:3000/docs', 'http://127.0.0.1/x', 'http://192.168.1.4/x', 'http://10.1.2.3/x', 'http://172.20.0.1/x',
    'http://100.100.1.1/x', 'http://[::1]/x', 'https://build.internal/x', 'https://nas.local/x', 'https://tool.example.com/a?token=abc', 'https://u:p@tool.example.com/']) {
    const data = fixture().data()
    data.products.find(p => p.id === 'tool').sources[0].url = url
    assert.throws(() => assertDirectoryShape(data), /Expected public URL/, url)
  }
})

test('a filter value on disk needs a resolvable receipt', () => {
  const inject = mutate => {
    const data = fixture().data()
    mutate(data.products.find(p => p.id === 'tool'), data)
    return data
  }
  for (const [mutate, message] of [
    [p => { p.facets.cli.claimId = null }, /has no receipt/],
    [p => { p.facets.cli.evidenceIds = [] }, /has no receipt/],
    [p => { p.facets.cli.claimId = 'tool:lifecycle' }, /no matching receipt/],
    [p => { p.facets.cli.evidenceIds = ['tool:run-01'] }, /no matching receipt/],
    [p => { p.facets.cli.nextCheckAt = '2099-01-01' }, /no matching receipt/],
    [p => { p.facets['web-client'].evidenceIds = ['tool:acc-01'] }, /carries a receipt/],
    [p => { p.claims[0].evidenceIds = ['tool:missing'] }, /Unresolved claim citation/],
    [p => { p.facets['lifecycle-status'] = { ...p.facets.cli, value: 'sunset', claimId: 'tool:lifecycle' } }, /differs from its notice/],
    [(p, data) => { data.statusLog[0].claimIds = ['tool:ACC-02'] }, /Unresolved status event/],
  ]) assert.throws(() => assertDirectoryShape(inject(mutate)), message)
})

test('the on-disk check accepts overdue snapshots but rejects future data, hand edits and hidden bytes', () => {
  const f = fixture()
  const temp = mkdtempSync(resolve(tmpdir(), 'ade-comparison-check-test-'))
  const output = resolve(temp, 'data')
  const safety = { profiles: f.profiles, registry: f.registry, privateRecords: Object.values(f.mappings) }
  try {
    writeDirectoryPackage(f.data(), output, safety)
    assert.doesNotThrow(() => checkDirectoryPackage(output, { ...safety, date, rebuild: () => f.data() }))
    assert.doesNotThrow(() => checkDirectoryPackage(output, { ...safety, date: due }))
    assert.doesNotThrow(() => checkDirectoryPackage(output, { ...safety, date: '2026-11-22' }))
    assert.throws(() => checkDirectoryPackage(output, { ...safety, date: '2026-11-06' }), /dated after/)
    const productPath = resolve(output, 'products/tool.json')
    const original = readFileSync(productPath, 'utf8')
    writeFileSync(productPath, original.replace('{', '{"name":"PRIVATE-INTERNAL-ANSWER-6d9b36",'))
    assert.throws(() => checkDirectoryPackage(output, { ...safety, date }), /Noncanonical/)
    writeFileSync(productPath, `${original}\n`)
    assert.throws(() => checkDirectoryPackage(output, { ...safety, date }), /Noncanonical/)
    const edited = JSON.parse(original)
    edited.facets.cli.crossCheckedAt = date
    edited.claims[0].verificationStatus = 'agent-cross-checked'
    edited.facets.cli.verificationStatus = 'agent-cross-checked'
    writeFileSync(productPath, `${JSON.stringify(edited)}\n`)
    const indexPath = resolve(output, 'index.json')
    const index = JSON.parse(readFileSync(indexPath, 'utf8'))
    const row = index.products.findIndex(p => p.id === 'tool')
    const bits = Buffer.from(index.bitsets.columns.cli.crossChecked, 'base64')
    bits[row >> 3] |= 1 << (row & 7)
    index.bitsets.columns.cli.crossChecked = bits.toString('base64')
    writeFileSync(indexPath, `${JSON.stringify(index)}\n`)
    assert.doesNotThrow(() => checkDirectoryPackage(output, { ...safety, date }))
    assert.throws(() => checkDirectoryPackage(output, { ...safety, date, rebuild: () => f.data() }), /differs from the catalog/)
  } finally { rmSync(temp, { recursive: true, force: true }) }
})

test('a malformed date override cannot stop findings from expiring', () => {
  const previous = Object.fromEntries(publicationDateVariables.map(name => [name, process.env[name]]))
  try {
    for (const name of publicationDateVariables) {
      for (const other of publicationDateVariables) delete process.env[other]
      for (const value of ['2026', 'garbage', '2026-11-7']) {
        process.env[name] = value
        assert.throws(() => publicationDate(), new RegExp(`${name} must be YYYY-MM-DD`))
      }
      process.env[name] = date
      assert.equal(publicationDate(), date)
    }
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('expiry only removes data and never makes the real package fail its safety scan', () => {
  const mappings = loadFacetMappings()
  const vocabulary = facetVocabulary(definitions)
  // A failed scan keeps the prior package, so a false positive here would keep
  // expired findings on the site. Fully expired is the widest private set.
  for (const scanDate of ['2026-12-08', '2030-01-01']) {
    const data = buildDirectoryFromPublication(buildPublication({ date: scanDate, format: 'products' }), { mappings })
    assertDirectoryShape(data)
    assert.doesNotThrow(() => assertPublicationSafe(Object.fromEntries(packageFiles(data)),
      { date: scanDate, privateRecords: Object.values(mappings), vocabulary }))
  }
})

test('writing scans before replacement and removes obsolete files on a valid rebuild', () => {
  const f = fixture()
  const temp = mkdtempSync(resolve(tmpdir(), 'ade-comparison-data-test-'))
  const output = resolve(temp, 'data')
  const safety = { profiles: f.profiles, registry: f.registry, privateRecords: Object.values(f.mappings) }
  try {
    const data = f.data()
    writeDirectoryPackage(data, output, safety)
    assert.doesNotThrow(() => checkDirectoryPackage(output, { ...safety, date }))
    const before = readFileSync(resolve(output, 'index.json'), 'utf8')
    const injected = structuredClone(data)
    injected.products.find(p => p.id === 'tool').claims[0].answer = 'PRIVATE-INTERNAL-ANSWER-6d9b36'
    assert.throws(() => writeDirectoryPackage(injected, output, safety), /Internal-only text/)
    assert.equal(readFileSync(resolve(output, 'index.json'), 'utf8'), before)
    const productPath = resolve(output, 'products/tool.json')
    const originalProduct = readFileSync(productPath, 'utf8')
    const tampered = JSON.parse(originalProduct)
    tampered.claims[0].answer = 'PRIVATE-FACET-RESEARCHER'
    writeFileSync(productPath, `${JSON.stringify(tampered)}\n`)
    assert.throws(() => checkDirectoryPackage(output, { ...safety, date }), /Private identity/)
    writeFileSync(productPath, originalProduct)
    writeFileSync(resolve(output, 'stray.json'), '{}\n')
    assert.throws(() => checkDirectoryPackage(output, { ...safety, date }), /Unexpected or missing/)
    rmSync(resolve(output, 'stray.json'))
    f.registry.splice(1, 1)
    writeDirectoryPackage(f.data(), output, safety)
    assert.equal(readdirSync(resolve(output, 'products')).includes('listing.json'), false)
    for (const value of readdirSync(output)) if (value.endsWith('.json')) {
      assert.doesNotThrow(() => JSON.parse(readFileSync(resolve(output, value), 'utf8')))
    }
    const unsafe = structuredClone(data)
    unsafe.products[0].id = '../escape'
    unsafe.index.products[0].id = '../escape'
    assert.throws(() => writeDirectoryPackage(unsafe, output, safety), /Unsafe public package filename/)
  } finally { rmSync(temp, { recursive: true, force: true }) }
})

test('unknown facet IDs and enum options fail instead of becoming silent unused data', () => {
  const f = fixture()
  assert.throws(() => productFacets(f.product, definitions, { surprise: {} }, date), /Undeclared facet/)
  assert.throws(() => productFacets(f.product, definitions, { execution: { surprise: {} } }, date), /Undeclared option/)
  assert.throws(() => publicFacet(f.product, definition('cli'), null, { ...f.mappings.tool.cli, value: true }, date), /Invalid facet value/)
})

test('real mappings cover all 36 launch products, use eligible receipts and remain safe to publish', () => {
  const mappings = loadFacetMappings()
  for (const id of ['agent-orchestrator', 'antigravity', 'capy', 'claude-code',
    'conductor', 'cursor', 'jetbrains-air', 'multica', 'orca', 'paseo', 'podium', 'superset', 't3-code',
    'amp', 'augment-code', 'cline', 'codex', 'devin', 'factory', 'github-copilot', 'jules', 'kiro', 'warp', 'warp-oz', 'zed',
    'buzz', 'claude-squad', 'cmux', 'emdash', 'jean', 'maestro', 'openhands', 'opencode', 'qm', 'tembo', 'vibe-kanban']) assert.ok(mappings[id], id)
  // Use the recorded snapshot date. Later research edits may correctly make
  // individual values unknown; tests must not silently refresh their hashes.
  const publication = buildPublication({ date: packageDate, format: 'products', directory: true })
  const data = buildDirectoryFromPublication(publication, { mappings })
  assertDirectoryShape(data)
  assertPublicationSafe(Object.fromEntries(packageFiles(data)), { date: packageDate, directory: true, privateRecords: Object.values(mappings),
    vocabulary: facetVocabulary(definitions) })
  for (const product of data.products.filter(p => p.facets)) {
    const sourceIds = new Set(product.sources.map(source => source.id))
    for (const cell of knownCells(product).filter(cell => cell.value !== 'unknown')) {
      assert.ok(cell.evidenceIds.length)
      assert.ok(cell.evidenceIds.every(id => sourceIds.has(id) && id.startsWith(`${product.id}:`)))
      assert.ok(product.claims.some(claim => claim.claimId === cell.claimId) || cell.claimId === `${product.id}:lifecycle`)
      if (cell.verificationStatus === 'agent-cross-checked' && cell.claimId !== `${product.id}:lifecycle`) assert.equal(
        product.claims.find(claim => claim.claimId === cell.claimId).verificationStatus, 'agent-cross-checked',
        `Cross-checked facet ${product.id} requires its finding's independent review`)
    }
  }
  assert.equal(JSON.stringify(data).includes('"quote"'), false)
  assert.ok(data.methodology.evidenceText.includes('finding and a locator'))
  assert.equal(JSON.stringify(data), JSON.stringify(buildDirectoryFromPublication(publication, { mappings })))
  assert.doesNotThrow(() => checkDirectoryPackage(undefined, { date: packageDate, privateRecords: Object.values(mappings) }))
})

test('returned launch interpretations retain their corrected scope and citations', () => {
  const data = buildDirectoryFromPublication(buildPublication({ date: packageDate, format: 'products', directory: true }))
  const product = id => data.products.find(product => product.id === id)
  // The November 13 source pass resolves the earlier Cloud-scope objections.
  // Current enterprise SSO eligibility remains unestablished after the revised announcement.
  const conductor = product('conductor')
  assert.equal(conductor.facets.sso.value, 'unknown')
  for (const [facet, evidenceIds] of Object.entries({
    'unattended-triggers': ['conductor:release', 'conductor:cl-0870', 'conductor:api'],
    multiplayer: ['conductor:cloud-faq', 'conductor:cl-0780'],
    'laptop-independent': ['conductor:gap37-cloud-continuation'],
    roles: ['conductor:gap37-cloud-org-permissions'],
  })) {
    const cell = conductor.facets[facet]
    assert.equal(cell.value, 'yes', facet)
    assert.deepEqual(cell.evidenceIds, evidenceIds, facet)
    assert.equal(cell.verificationStatus, 'sourced', facet)
    assert.equal(cell.crossCheckedAt, null, facet)
  }
  const continuation = conductor.sources.find(source => source.id === 'conductor:gap37-cloud-continuation')
  assert.equal(continuation.url, 'https://www.conductor.build/docs/cloud')
  assert.match(continuation.finding, /after the laptop closes/)
  const permissions = conductor.sources.find(source => source.id === 'conductor:gap37-cloud-org-permissions')
  assert.equal(permissions.url, 'https://www.conductor.build/docs/cloud/getting-started')
  assert.match(permissions.finding, /Organization admins/)
  assert.equal(conductor.facets.isolation.vm.value, 'yes')
  assert.deepEqual(conductor.facets.isolation.vm.evidenceIds, ['conductor:cloud-computer', 'conductor:cloud-faq'])
  assert.equal(conductor.facets.execution['vendor-cloud'].value, 'yes')
  assert.deepEqual(conductor.facets.execution['vendor-cloud'].evidenceIds,
    ['conductor:gap37-cloud-platform', 'conductor:gap37-cloud-continuation'])
  assert.equal(conductor.facets.execution.local.value, 'yes')
  assert.deepEqual(conductor.facets.isolation.worktree.evidenceIds, ['conductor:workspaces'])
  // A later source pass sourced a user-owned remote host; the earlier laptop-only receipt no longer decides this.
  // The 2026-11-10 recheck re-cites the same remote-access guide at a newer commit.
  assert.equal(product('t3-code').facets['laptop-independent'].value, 'yes')
  assert.deepEqual(product('t3-code').facets['laptop-independent'].evidenceIds, ['t3-code:remote-nov10'])
  assert.notEqual(product('superset').facets.license.value, 'elastic-2-0')
  assert.deepEqual(product('superset').formerNames, ['Superset'])
  for (const [facet, evidenceIds] of Object.entries({
    'parallel-runs': ['superset:agents-chk2-nov07'],
    coordinator: ['superset:orchestration-chk2-nov07'],
    'review-ui': ['superset:diff-chk2-nov07'],
  })) {
    assert.equal(product('superset').facets[facet].value, 'yes', facet)
    assert.deepEqual(product('superset').facets[facet].evidenceIds, evidenceIds, facet)
  }
  // A later shipped-local-core source resolves the earlier MIT-only objection;
  // hosted relay, Pages and Cloud service parity remain outside this claim.
  const selfHosting = product('superset').facets['self-hosting']
  assert.equal(selfHosting.value, 'yes')
  assert.deepEqual(selfHosting.evidenceIds, ['superset:gaps41-local-core', 'superset:readme-chk2-nov07'])
  const localCore = product('superset').sources.find(source => source.id === 'superset:gaps41-local-core')
  assert.equal(localCore.url, 'https://paradev.com/roadmap')
  assert.match(localCore.finding, /signed out and offline/)
  // The November open-source depth pass added Pi and Grok from the same agents page.
  for (const agent of ['claude-code', 'codex', 'cursor', 'opencode', 'gemini-cli', 'pi', 'grok']) {
    assert.equal(product('superset').facets.agents[agent].value, 'yes', agent)
    assert.deepEqual(product('superset').facets.agents[agent].evidenceIds, ['superset:agents-chk2-nov07'], agent)
  }
  for (const agent of ['aider']) {
    assert.equal(product('superset').facets.agents[agent].value, 'unknown', agent)
  }
  assert.deepEqual(product('superset').facets.isolation.worktree.evidenceIds, ['superset:d-workspaces-nov07'])
  assert.equal(product('paseo').facets.execution.local.value, 'yes')
  assert.deepEqual(product('paseo').facets.execution.local.evidenceIds, ['paseo:doc-why'])
  assert.equal(product('paseo').facets.license.value, 'apache-2-0')
  assert.equal(product('paseo').facets.license.verificationStatus, 'agent-cross-checked')
  assert.deepEqual(product('paseo').facets.license.evidenceIds,
    ['paseo:license-chk2-nov07', 'paseo:desktop-license-chk2-nov07'])
  for (const [option, evidenceId] of [['worktree', 'worktrees-chk3-nov07'], ['vm', 'cloud-env-nov07']]) {
    const cell = product('claude-code').facets.isolation[option]
    assert.equal(cell.value, 'yes', option)
    assert.deepEqual(cell.evidenceIds, [`claude-code:${evidenceId}`], option)
    const source = product('claude-code').sources.find(source => source.id === cell.evidenceIds[0])
    assert.ok(source.retrievedAt >= product('claude-code').claims.find(claim => claim.claimId === cell.claimId).checkedAt)
  }
  // A later source pass sourced the documented dev-container option for container isolation.
  assert.deepEqual(product('claude-code').facets.isolation.container.evidenceIds, ['claude-code:gap07-container-options'])
  assert.equal(product('vibe-kanban').facets['issue-tracking'].value, 'no')
  assert.equal(product('vibe-kanban').facets.execution.local.value, 'yes')
})

// A license mapping either awaits review or carries an accepted review from a
// different agent, bound to its current digest.
const assertLicenseReceipt = (id, entry, cell, hash) => {
  if (entry.review === null) {
    assert.equal(cell.verificationStatus, 'sourced', id)
    assert.equal(cell.crossCheckedAt, null, id)
    return
  }
  assert.equal(entry.review.state, 'accepted', id)
  assert.notEqual(entry.review.reviewer, entry.researcher, id)
  assert.equal(entry.review.contentHash, hash, id)
  // An accepted mapping on a finding that is itself still unreviewed publishes as sourced.
  if (cell.verificationStatus === 'sourced') return
  assert.equal(cell.verificationStatus, 'agent-cross-checked', id)
  assert.equal(cell.crossCheckedAt, entry.review.date, id)
}

test('GPL and AGPL application findings have current license mappings, sourced or independently reviewed', () => {
  const mappings = loadFacetMappings()
  const publication = buildPublication({ date: packageDate, format: 'products', directory: true })
  const data = buildDirectoryFromPublication(publication, { mappings })
  const expected = { proliferate: 'agpl-3-0', xum: 'agpl-3-0', 'claude-squad': 'agpl-3-0',
    cmux: 'gpl-3-0-or-later', maestro: 'agpl-3-0', zed: 'gpl-3-0-or-later', warp: 'agpl-3-0' }
  for (const [id, value] of Object.entries(expected)) {
    const product = data.products.find(product => product.id === id)
    const entry = mappings[id].license
    assert.equal(entry.value, value, id)
    assert.equal(entry.claimId, `${id}:OWN-01`, id)
    const hash = facetReviewHash(publication.products.find(p => p.id === id), 'license', null, entry, definition('license'))
    assert.equal(entry.contentHash, hash, id)
    assert.equal(product.facets.license.value, value, id)
    assertLicenseReceipt(id, entry, product.facets.license, hash)
  }
  for (const product of data.products.filter(p => mappings[p.id]?.license)) {
    const entry = mappings[product.id].license
    if (entry.review?.state === 'changes-requested') continue
    assert.equal(product.facets.license.value, entry.value, product.id)
    assertLicenseReceipt(product.id, entry, product.facets.license, entry.contentHash)
  }
  assert.match(mappings.cmux.license.rationale, /BUSL-1\.1/)
  assert.match(mappings.zed.license.rationale, /Apache-2\.0 components/)
  assert.match(mappings.xum.license.rationale, /AGPL-3\.0-only/)
  assert.match(mappings.warp.license.rationale, /404/)
})

test('directory opt-in retains overdue sourced and reviewed findings, typed values and check dates', () => {
  const f = fixture()
  const candidate = f.profile.claims.find(claim => claim.criterionId === 'ACC-01')
  candidate.publication = 'public-candidate'; candidate.review = null
  const publication = buildDate => buildPublicationFromProfiles(f.profiles, { date: buildDate, format: 'products', registry: f.registry, directory: true })
  const initial = publication(date).products.find(product => product.id === 'tool')
  const entry = f.mappings.tool.cli
  entry.contentHash = facetReviewHash(initial, 'cli', null, entry, definition('cli'))
  const late = '2027-06-01'
  const data = buildDirectoryFromPublication(publication(late), { mappings: f.mappings })
  const product = data.products.find(product => product.id === 'tool')
  assert.equal(f.publish(late).products.find(product => product.id === 'tool').claims.length, 0)
  assert.equal(product.claims.length, 4)
  assert.equal(knownCells(product).filter(cell => cell.value !== 'unknown').length, 4)
  assert.equal(product.facets.cli.verificationStatus, 'sourced')
  assert.equal(product.facets.cli.checkedAt, date)
  assert.equal(product.facets.cli.nextCheckAt, due)
  assert.equal(product.claims[0].checkedAt, checkedAt)
  assert.equal(data.statusLog.length, 1)
  assertDirectoryShape(data)
  const safety = { date: late, profiles: f.profiles, registry: f.registry, privateRecords: Object.values(f.mappings), directory: true }
  assertPublicationSafe(Object.fromEntries(packageFiles(data)), safety)
  for (const text of ['PRIVATE-INTERNAL-ANSWER-6d9b36', 'PRIVATE-RESEARCHER', 'PRIVATE-FACET-RESEARCHER']) {
    assert.throws(() => assertPublicationSafe({ answer: text }, safety), /Internal|Private/)
  }
  const temp = mkdtempSync(resolve(tmpdir(), 'ade-comparison-retained-test-'))
  try {
    writeDirectoryPackage(data, resolve(temp, 'data'), safety)
    assert.doesNotThrow(() => checkDirectoryPackage(resolve(temp, 'data'), { ...safety, date: '2030-01-01' }))
  } finally { rmSync(temp, { recursive: true, force: true }) }
  assert.throws(() => buildPublicationFromProfiles(f.profiles, { date, directory: true }), /requires products/)
})

test('directory lifecycle candidates need first-party public sources and keep optional cross-checks', () => {
  const f = fixture()
  const profile = f.profiles[1]
  profile.evidence.push({ id: 'shutdown', kind: 'documented', url: 'https://other.example.com/shutdown', title: 'Shutdown announcement',
    locator: 'Service dates', sourceDate: checkedAt, retrievedAt: checkedAt, finding: 'This hosted service is shutting down.', visibility: 'public', commit: null, path: null })
  profile.lifecycle = { status: 'sunset', note: 'This hosted service is shutting down.', scope: 'Hosted service only', continuation: 'The local application continues.',
    announcementDate: checkedAt, serviceEndDate: null, checkedAt, nextReviewAt: due, evidenceIds: ['shutdown'], researcher: 'PRIVATE-LIFECYCLE-RESEARCHER',
    publication: 'public-candidate', contradictions: [], review: null }
  const publish = () => buildPublicationFromProfiles(f.profiles, { date: '2027-06-01', format: 'products', registry: f.registry, directory: true })
  const data = () => buildDirectoryFromPublication(publish(), { mappings: f.mappings })
  assert.equal(f.publish().products.find(product => product.id === 'other').lifecycle.status, 'unknown')
  const notice = data().lifecycleNotices[0]
  assert.equal(notice.productId, 'other')
  assert.equal(notice.crossCheckedAt, null)
  assert.equal(notice.facet.verificationStatus, 'sourced')
  assert.equal(notice.checkedAt, checkedAt)
  assert.equal(notice.nextCheckAt, due)
  assert.deepEqual(Object.keys(data().products.find(product => product.id === 'other')).sort(), ['id', 'name', 'researchStatus', 'website'])
  assertDirectoryShape(data())
  const safety = { date: '2027-06-01', profiles: f.profiles, registry: f.registry, directory: true }
  assertPublicationSafe(Object.fromEntries(packageFiles(data())), safety)
  for (const mutate of [
    () => profile.evidence[0].url = 'https://unrelated.example.org/shutdown',
    () => profile.evidence[0].url = 'https://other.example.com.unrelated.org/shutdown',
    () => profile.evidence[0].visibility = 'internal',
    () => profile.evidence[0].retrievedAt = '2027-06-02',
    () => profile.lifecycle.contradictions = ['Conflicting date'],
    () => profile.lifecycle.publication = 'internal-only',
  ]) {
    const before = structuredClone(profile)
    mutate()
    assert.equal(data().lifecycleNotices.length, 0)
    Object.assign(profile, before)
  }
  profile.lifecycle.publication = 'public-reviewed'
  profile.lifecycle.review = { reviewer: 'PRIVATE-LIFECYCLE-REVIEWER', date: checkedAt, contentHash: lifecycleReviewHash(profile) }
  assert.equal(data().lifecycleNotices[0].facet.verificationStatus, 'agent-cross-checked')
  profile.evidence[0].finding = 'Edited after review.'
  assert.throws(() => publish(), /review content hash differs/)
})

test('directory-retained real data still passes all privacy checks far beyond its recheck dates', () => {
  const mappings = loadFacetMappings(), vocabulary = facetVocabulary(definitions)
  const count = data => data.products.reduce((sum, product) => sum + (product.claims?.length || 0), 0)
  const original = buildDirectoryFromPublication(buildPublication({ date: packageDate, format: 'products', directory: true }), { mappings })
  const later = buildDirectoryFromPublication(buildPublication({ date: '2030-01-01', format: 'products', directory: true }), { mappings })
  assert.equal(count(later), count(original))
  assertDirectoryShape(later)
  assertPublicationSafe(Object.fromEntries(packageFiles(later)), { date: '2030-01-01', privateRecords: Object.values(mappings), vocabulary, directory: true })
})

test('an option added to a multi-select filter keeps earlier mappings and binds later ones', () => {
  const f = fixture()
  const entry = f.mappings.tool.execution.local
  const added = addedAt => {
    const revised = structuredClone(definition('execution'))
    revised.options.push({ id: 'new-place', label: 'New place', ...(addedAt ? { addedAt } : {}) })
    return revised
  }
  // The mapping was checked on the fixture date, before the option existed.
  assert.equal(publicFacet(f.product, added('2026-11-08'), 'local', entry, date).value, 'yes')
  // Undated additions and additions on or before the check change the digest, as before.
  assert.equal(publicFacet(f.product, added(null), 'local', entry, date).value, 'unknown')
  assert.equal(publicFacet(f.product, added(entry.checkedAt), 'local', entry, date).value, 'unknown')
  // A mapping recorded after the addition binds the whole revised definition.
  const later = { ...entry, contentHash: null }
  later.contentHash = facetReviewHash(f.product, 'execution', 'local', later, added('2026-11-01'))
  assert.equal(publicFacet(f.product, added('2026-11-01'), 'local', later, date).value, 'yes')
  // A single-choice filter may not mark an added option: a new choice can change an existing answer.
  const license = structuredClone(definitions)
  license.facets.find(facet => facet.id === 'license').options.push({ id: 'new-license', label: 'New license', addedAt: '2026-11-08' })
  assert.throws(() => validateDefinitions(license), /addedAt/)
  const badDate = structuredClone(definitions)
  badDate.facets.find(facet => facet.id === 'agents').options.at(-1).addedAt = 'soon'
  assert.throws(() => validateDefinitions(badDate), /addedAt/)
})

test('GitHub stars publish only with a public source on the product repository', () => {
  const starred = (url, { visibility = 'public', directory = true, observedAt = '2026-11-02' } = {}) => {
    const f = fixture()
    f.profile.identity.repository = 'https://github.com/tool-org/tool'
    f.profile.evidence.push({ id: 'github-metadata', kind: 'documented', url, title: 'Repository metadata',
      locator: 'stargazers_count', sourceDate: null, retrievedAt: '2026-11-02', finding: 'Repository star count read from the API.',
      visibility, commit: null, path: null })
    f.profile.context.marketContext = { githubStars: { value: 1234, observedAt, evidenceIds: ['github-metadata'] } }
    recordFixtureClaimReviews(f.profile)
    const publication = buildPublicationFromProfiles(f.profiles, { date, format: 'products', registry: f.registry, directory })
    return { f, publication, product: publication.products.find(p => p.id === 'tool') }
  }
  const { f, publication, product } = starred('https://api.github.com/repos/Tool-Org/tool')
  assert.deepEqual(product.githubStars, { value: 1234, observedAt: '2026-11-02', evidenceIds: ['tool:github-metadata'] })
  assert.ok(product.sources.some(source => source.id === 'tool:github-metadata'))
  const data = buildDirectoryFromPublication(publication, { mappings: f.mappings })
  assertDirectoryShape(data)
  assert.deepEqual(data.products.find(p => p.id === 'tool').githubStars, product.githubStars)
  assert.equal(validatePackage({ index: data.index, definitions: data.facets, products: data.products,
    notices: data.lifecycleNotices, status: data.statusLog, methodology: data.methodology }, date), true)
  const broken = structuredClone(data)
  broken.products.find(p => p.id === 'tool').githubStars.evidenceIds = ['tool:missing']
  assert.throws(() => assertDirectoryShape(broken), /GitHub stars/)
  for (const [url, options] of [
    ['https://api.github.com/repos/someone-else/tool', {}],
    ['https://github.com/tool-org/tool', { visibility: 'internal' }],
    ['https://example.com/tool-org/tool', {}],
    ['https://github.com/tool-org/tool', { directory: false }],
    ['https://github.com/tool-org/tool', { observedAt: '2026-12-01' }],
  ]) assert.equal(starred(url, options).product.githubStars, undefined, `${url} ${JSON.stringify(options)}`)
})
