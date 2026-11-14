import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { afterDays, claimReviewHash, createUnknownProfile, updateClaim, validateProfile } from './lib.mjs'
import { buildPublicationFromProfiles } from './publication/build.mjs'
import { buildDirectoryFromPublication } from './directory/build.mjs'
import { assertDirectoryShape } from './directory/security.mjs'
import { validatePackage } from '../scripts/validate-data.mjs'

const passDate = '2026-11-13'
const oldCheck = '2026-10-09'
const oldDue = '2026-11-08'
const claimFor = profile => profile.claims.find(claim => claim.criterionId === 'OWN-02')

function fixture(t, { unknown = false } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'ade-author-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  // Run the real CLI against a small isolated catalog, never the checked-in data.
  for (const file of ['directory/author.mjs', 'directory/facets.mjs', 'directory/facets.json',
    'lib.mjs', 'criteria.json', 'schema.json', 'publication/build.mjs', 'publication/config.json']) {
    const target = resolve(root, 'research', file)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(new URL(file, import.meta.url), target)
  }
  const profile = createUnknownProfile({ id: 'fixture', name: 'Fixture',
    identity: { website: 'https://fixture.example.com' },
    surfaces: [{ id: 'desktop', name: 'Desktop', type: 'desktop' }],
  }, { date: oldCheck, researcher: 'original-researcher' })
  profile.evidence.push({ id: 'old-export', kind: 'documented', url: 'https://fixture.example.com/export',
    title: 'Export documentation', locator: 'Export formats', sourceDate: null, retrievedAt: oldCheck,
    finding: 'The local client exports saved work.', visibility: 'public', commit: null, path: null })
  if (!unknown) {
    const claim = updateClaim(profile, 'OWN-02', { support: 'partial', answer: 'Export is documented; hosting has not been checked.',
      availability: 'generally-available', delivery: 'native', limitations: ['Hosting and other exit details have not been checked.'],
      evidenceIds: ['old-export'], scope: { surfaceIds: ['desktop'] }, nextReviewAt: oldDue,
      subanswers: { export: { support: 'supported', answer: 'The client exports saved work.', evidenceIds: ['old-export'] } },
      publication: 'public-reviewed' })
    claim.review = { reviewer: 'original-reviewer', date: oldCheck, contentHash: claimReviewHash(profile, claim) }
  }
  const profilePath = resolve(root, 'research/products/fixture.json')
  const mappingPath = resolve(root, 'research/directory/products/fixture.json')
  const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`) }
  write(profilePath, profile)
  write(mappingPath, {})
  const readProfile = () => JSON.parse(readFileSync(profilePath, 'utf8'))
  const readMappings = () => JSON.parse(readFileSync(mappingPath, 'utf8'))
  const apply = spec => {
    const specPath = resolve(root, 'pass.json')
    write(specPath, spec)
    return spawnSync(process.execPath, [resolve(root, 'research/directory/author.mjs'), 'apply', specPath], {
      cwd: root, encoding: 'utf8', env: { ...process.env, ADE_COMPARISON_PUBLICATION_DATE: passDate },
    })
  }
  return { profile, profilePath, mappingPath, readProfile, readMappings, apply }
}

const sourcePass = () => ({ product: 'fixture', researcher: 'recheck-researcher', summary: 'Checked the documented hosting restriction.',
  evidence: [{ id: 'hosting-recheck', kind: 'documented', url: 'https://fixture.example.com/hosting',
    title: 'Hosting documentation', locator: 'Control plane', sourceDate: passDate,
    finding: 'The control plane requires the vendor service and cannot be self-hosted.' }],
  claims: { 'OWN-02': { checkedAt: passDate, nextReviewAt: '2026-12-13', support: 'partial',
    answer: 'The control plane cannot be self-hosted; the local client exports saved work.',
    availability: 'generally-available', delivery: 'native', scope: { surfaceIds: ['desktop'] },
    limitations: ['Other exit details have not been checked.'], evidenceIds: ['hosting-recheck'],
    subanswers: { self_hosting: { support: 'unsupported', answer: 'The vendor control plane cannot be self-hosted.', evidenceIds: ['hosting-recheck'] } },
  } },
  mappings: { 'self-hosting': { value: 'no', claim: 'OWN-02', evidenceIds: ['hosting-recheck'], rationale: 'The vendor control plane cannot be self-hosted.' } },
})

function publicData(profile, mappings, date = passDate) {
  const publication = buildPublicationFromProfiles([profile], { date, format: 'products', directory: true })
  return buildDirectoryFromPublication(publication, { mappings: { fixture: mappings }, formerNames: {} })
}

function validatePublicData(data, date = passDate) {
  assertDirectoryShape(data)
  assert.equal(validatePackage({ index: data.index, definitions: data.facets, products: data.products,
    notices: data.lifecycleNotices, status: data.statusLog, methodology: data.methodology }, date), true)
}

test('an answered overdue finding accepts a source recheck and a freshly checked mapping', t => {
  const f = fixture(t)
  const result = f.apply(sourcePass())
  assert.equal(result.status, 0, result.stderr)
  const profile = f.readProfile()
  const claim = claimFor(profile)
  assert.deepEqual(validateProfile(profile), [])
  assert.equal(claim.checkedAt, passDate)
  assert.equal(claim.nextReviewAt, '2026-12-13')
  assert.equal(claim.publication, 'public-candidate')
  assert.equal(claim.review, null)
  assert.equal(claim.researcher, 'recheck-researcher')
  // A hosting recheck does not recite its new source for any older atomic answer.
  for (const [key, answer] of Object.entries(claimFor(f.profile).subanswers)) {
    if (key !== 'self_hosting') assert.deepEqual(claim.subanswers[key], answer)
  }
  assert.deepEqual(profile.evidence[0], f.profile.evidence[0])
  assert.deepEqual(claim.evidenceIds, ['old-export', 'hosting-recheck'])
  assert.equal(profile.evidence[1].retrievedAt, passDate)
  const change = profile.changes.at(-1)
  assert.equal(change.before.checkedAt, oldCheck)
  assert.equal(change.before.nextReviewAt, oldDue)
  assert.equal(change.after.checkedAt, passDate)
  assert.equal(change.after.nextReviewAt, claim.nextReviewAt)

  const mappings = f.readMappings()
  assert.equal(mappings['self-hosting'].review, null)
  const beforeBuild = JSON.stringify({ profile, mappings })
  for (const date of [passDate, '2027-06-01']) {
    const data = publicData(profile, mappings, date)
    const product = data.products[0]
    const cell = product.facets['self-hosting']
    assert.equal(cell.value, 'no')
    assert.equal(cell.verificationStatus, 'sourced')
    assert.equal(cell.checkedAt, passDate)
    assert.equal(cell.nextCheckAt, '2026-12-13')
    assert.deepEqual(cell.evidenceIds, ['fixture:hosting-recheck'])
    assert.deepEqual(product.claims[0].questions.find(q => q.id === 'export').evidenceIds, ['fixture:old-export'])
    validatePublicData(data, date)
  }
  assert.equal(JSON.stringify({ profile, mappings }), beforeBuild)
})

test('explicit rechecks default the deadline from checkedAt and preserve the supplied retrieval date', t => {
  const f = fixture(t)
  const spec = sourcePass()
  spec.claims['OWN-02'].checkedAt = '2026-11-12'
  delete spec.claims['OWN-02'].nextReviewAt
  spec.evidence[0].sourceDate = '2026-11-11'
  spec.evidence[0].retrievedAt = '2026-11-12'
  const result = f.apply(spec)
  assert.equal(result.status, 0, result.stderr)
  const profile = f.readProfile()
  assert.equal(claimFor(profile).checkedAt, '2026-11-12')
  assert.equal(claimFor(profile).nextReviewAt, afterDays('2026-11-12', 180))
  assert.equal(profile.evidence[1].retrievedAt, '2026-11-12')
  validatePublicData(publicData(profile, f.readMappings()))
})

test('an existing finding keeps its dates when a pass only adds an atomic answer and mapping', t => {
  const f = fixture(t)
  const spec = sourcePass()
  delete spec.claims['OWN-02'].checkedAt
  delete spec.claims['OWN-02'].nextReviewAt
  const result = f.apply(spec)
  assert.equal(result.status, 0, result.stderr)
  const profile = f.readProfile()
  assert.equal(claimFor(profile).checkedAt, oldCheck)
  assert.equal(claimFor(profile).nextReviewAt, oldDue)
  const data = publicData(profile, f.readMappings(), '2027-06-01')
  assert.equal(data.products[0].facets['self-hosting'].checkedAt, passDate)
  assert.equal(data.products[0].facets['self-hosting'].nextCheckAt, oldDue)
  validatePublicData(data, '2027-06-01')
})

test('a previously unknown finding still uses the pass date and default deadline', t => {
  const f = fixture(t, { unknown: true })
  const spec = sourcePass()
  delete spec.claims['OWN-02'].checkedAt
  delete spec.claims['OWN-02'].nextReviewAt
  const result = f.apply(spec)
  assert.equal(result.status, 0, result.stderr)
  const profile = f.readProfile()
  assert.equal(claimFor(profile).checkedAt, passDate)
  assert.equal(claimFor(profile).nextReviewAt, afterDays(passDate, 180))
  validatePublicData(publicData(profile, f.readMappings()))
})

test('an unknown gap can still be updated without inventing a source recheck', t => {
  const f = fixture(t, { unknown: true })
  const result = f.apply({ product: 'fixture', researcher: 'gap-researcher', summary: 'Recorded a source access gap.',
    claims: { 'OWN-02': { answer: 'Hosting documentation is inaccessible.', unknownReason: 'Hosting documentation is inaccessible.' } } })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(claimFor(f.readProfile()).support, 'unknown')
  assert.equal(claimFor(f.readProfile()).evidenceIds.length, 0)
  assert.deepEqual(f.readProfile().evidence, f.profile.evidence)
})

test('invalid dates and unsupported source rechecks leave both files unchanged', async t => {
  const cases = [
    ['invalid check', spec => spec.claims['OWN-02'].checkedAt = '2026-02-30', /checkedAt must be a calendar date/],
    ['null check', spec => spec.claims['OWN-02'].checkedAt = null, /checkedAt must be a calendar date/],
    ['future check', spec => spec.claims['OWN-02'].checkedAt = '2026-11-14', /checkedAt must be a calendar date/],
    ['invalid deadline', spec => spec.claims['OWN-02'].nextReviewAt = '2026-11', /nextReviewAt must be a calendar date/],
    ['null deadline', spec => spec.claims['OWN-02'].nextReviewAt = null, /nextReviewAt must be a calendar date/],
    ['deadline before check', spec => spec.claims['OWN-02'].nextReviewAt = oldDue, /nextReviewAt must be a calendar date/],
    ['deadline without recheck', spec => delete spec.claims['OWN-02'].checkedAt, /nextReviewAt needs an explicit checkedAt/],
    ['invalid retrieval', spec => spec.evidence[0].retrievedAt = '2026-11-31', /retrievedAt must be a calendar date/],
    ['null retrieval', spec => spec.evidence[0].retrievedAt = null, /retrievedAt must be a calendar date/],
    ['future retrieval', spec => spec.evidence[0].retrievedAt = '2026-11-14', /retrievedAt must be a calendar date/],
    ['invalid source date', spec => spec.evidence[0].sourceDate = 'yesterday', /sourceDate must be a calendar date/],
    ['source after retrieval', spec => spec.evidence[0].sourceDate = '2026-11-14', /sourceDate must be a calendar date/],
    ['stale retrieved evidence', spec => { spec.evidence[0].retrievedAt = oldCheck; spec.evidence[0].sourceDate = null }, /checkedAt needs a cited source recheck/],
    ['uncited fresh evidence', spec => {
      spec.claims['OWN-02'].evidenceIds = ['old-export']
      spec.claims['OWN-02'].subanswers.self_hosting.evidenceIds = ['old-export']
    }, /checkedAt needs a cited source recheck/],
    ['unknown evidence', spec => spec.claims['OWN-02'].evidenceIds = ['missing'], /unknown evidence missing/],
    ['mapping still cites older atomic evidence', spec => spec.mappings['self-hosting'].evidenceIds = ['old-export'], /does not publish/],
  ]
  for (const [name, mutate, error] of cases) await t.test(name, t => {
    const f = fixture(t)
    const before = [f.profilePath, f.mappingPath].map(path => readFileSync(path, 'utf8'))
    const spec = sourcePass()
    mutate(spec)
    const result = f.apply(spec)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, error)
    assert.deepEqual([f.profilePath, f.mappingPath].map(path => readFileSync(path, 'utf8')), before)
  })
})
