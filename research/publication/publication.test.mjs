import assert from 'node:assert/strict'
import test from 'node:test'
import { loadProducts, claimReviewHash, createUnknownProfile, lifecycleReviewHash } from '../lib.mjs'
import {
  buildPublicationFromProfiles,
  indexToMarkdown,
  pairToMarkdown,
  publicationConfig,
  publicLifecycle,
  lifecycleNotice,
  lifecycleToHtml,
} from './build.mjs'

const products = loadProducts()
const fullProfiles = products.filter((product) => product.researchTier === 'full-profile')
// Evaluate the current evidence batch, independent of the calendar or later test mutations.
const date = fullProfiles
  .flatMap((product) =>
    [...product.claims.flatMap((claim) => [claim.checkedAt, claim.review?.date]), product.lifecycle?.checkedAt, product.lifecycle?.review?.date],
  )
  .filter(Boolean)
  .sort()
  .at(-1)
const publication = buildPublicationFromProfiles(products, { date })
const claimsOf = (pair) => pair.criteria.flatMap((criterion) => criterion.products)

// Rule tests build the states they need here, so they survive any catalog
// refresh, expiry or review reset. Only the profile shape comes from the catalog.
const fixtureDate = '2026-06-15'
const fixtureDueDate = '2026-07-15'
const citedEvidenceIds = (claim) => [
  ...claim.evidenceIds,
  ...Object.values(claim.subanswers).flatMap((answer) => answer.evidenceIds),
]
const bindFixtureReviews = profile => {
  for (const claim of profile.claims) if (claim.review) claim.review.contentHash = claimReviewHash(profile, claim)
  return profile
}
const stageProfile = (source) => {
  const profile = structuredClone(source)
  delete profile.lifecycle
  for (const evidence of profile.evidence) {
    evidence.retrievedAt = fixtureDate
    evidence.sourceDate = null
  }
  const evidenceById = new Map(profile.evidence.map((evidence) => [evidence.id, evidence]))
  for (const claim of profile.claims) {
    const publishable =
      claim.support !== 'unknown' &&
      claim.scope.surfaceIds.length > 0 &&
      claim.evidenceIds.length > 0 &&
      citedEvidenceIds(claim).every((id) => {
        const evidence = evidenceById.get(id)
        return (
          evidence?.visibility === 'public' &&
          evidence.kind !== 'unresolved' &&
          /^https?:\/\//.test(evidence.url)
        )
      })
    claim.checkedAt = fixtureDate
    claim.nextReviewAt = fixtureDueDate
    claim.researcher = 'fixture-researcher'
    claim.publication = publishable ? 'public-reviewed' : 'internal-only'
    claim.review = publishable ? { reviewer: 'fixture-reviewer', date: fixtureDate } : null
    if (publishable) claim.contradictions = []
  }
  return bindFixtureReviews(profile)
}
// Every publishable claim starts fresh and cross-checked at fixtureDate.
const fixture = (ids = ['conductor', 'podium']) =>
  products.filter((product) => ids.includes(product.id)).map(stageProfile)
const makeCandidate = (claim) => {
  claim.publication = 'public-candidate'
  claim.review = null
}
const stagedProfiles = fixture(['conductor', 'orca', 'podium', 'superset'])
for (const profile of stagedProfiles)
  makeCandidate(profile.claims.find((claim) => claim.publication === 'public-reviewed'))
const stagedPublication = buildPublicationFromProfiles(stagedProfiles, { date: fixtureDate })
const claimById = (pair, id) => claimsOf(pair).find((claim) => claim.claimId === id)

test('publishes every unordered full-profile pair regardless of reviewed overlap', () => {
  assert.ok(fullProfiles.length >= 55)
  const ids = fullProfiles.map((product) => product.id).sort()
  const expected = ids.flatMap((left, index) =>
    ids.slice(index + 1).map((right) => `${left}-vs-${right}`),
  )
  assert.equal(publication.pairs.length, fullProfiles.length * (fullProfiles.length - 1) / 2)
  assert.deepEqual(publication.pairs.map((pair) => pair.slug).sort(), expected.sort())
  assert.deepEqual(
    publication.comparisons.map((pair) => pair.slug),
    publication.pairs.map((pair) => pair.slug),
  )
  assert.deepEqual(publication.omittedProducts, [])
  assert.ok(
    publication.pairs.every(
      (pair) => pair.coverage.totalCriteria === 51 && pair.criteria.length === 51,
    ),
  )
})

test('keeps Podium commercial control explicit in every public pair', () => {
  assert.equal(publication.publisher.marketParticipant, true)
  assert.match(publication.publisher.disclosure, /vendor-authored research/)
  assert.match(publication.publisher.editorialControl, /product.*rubric.*sources.*wording/)
  assert.ok(publication.pairs.every((pair) => pair.publisher === publication.publisher))
  assert.match(indexToMarkdown(publication), /vendor-authored research/)
  assert.match(pairToMarkdown(publication.pairs[0]), /vendor-authored research/)
})

const assertCoverageContract = (result) => {
  for (const pair of result.pairs) {
    for (const product of pair.products) {
      const claims = claimsOf(pair).filter((claim) => claim.productId === product.id)
      const crossChecked = claims.filter(
        (claim) => claim.verificationStatus === 'agent-cross-checked',
      )
      const sourcedOnly = claims.filter((claim) => claim.verificationStatus === 'sourced')
      assert.equal(product.crossCheckedClaimCount, crossChecked.length)
      assert.equal(product.sourcedOnlyClaimCount, sourcedOnly.length)
      assert.equal(product.sourcedClaimCount, crossChecked.length + sourcedOnly.length)
      const dates = claims
        .filter((claim) => claim.checkedAt)
        .map((claim) => claim.checkedAt)
        .sort()
      assert.equal(product.oldestCheckedAt, dates[0] ?? null)
      assert.equal(product.lastCheckedAt, dates.at(-1) ?? null)
      assert.ok(sourcedOnly.every((claim) => claim.crossCheckedAt === null))
      assert.ok(crossChecked.every((claim) => typeof claim.crossCheckedAt === 'string'))
    }
    assert.equal(
      pair.coverage.sharedCrossCheckedCriteria,
      pair.criteria.filter((row) =>
        row.products.every((claim) => claim.verificationStatus === 'agent-cross-checked'),
      ).length,
    )
    assert.equal(
      pair.coverage.sharedSourcedCriteria,
      pair.criteria.filter((row) =>
        row.products.every((claim) => claim.verificationStatus !== 'not-published'),
      ).length,
    )
  }
}

test('keeps sourced findings and agent cross-checks distinct in the public contract', () => {
  const exported = new Map(
    publication.pairs.flatMap((pair) => pair.products).map((product) => [product.id, product]),
  )
  assert.equal(exported.size, fullProfiles.length)
  assertCoverageContract(publication)

  const staged = new Map(
    stagedPublication.pairs.flatMap((pair) => pair.products).map((product) => [product.id, product]),
  )
  assert.equal(staged.size, stagedProfiles.length)
  assert.ok([...staged.values()].every((product) => product.sourcedOnlyClaimCount > 0))
  assert.ok([...staged.values()].every((product) => product.crossCheckedClaimCount > 0))
  assertCoverageContract(stagedPublication)
  assert.ok(
    stagedPublication.pairs.find((pair) => pair.slug === 'conductor-vs-podium').coverage
      .sharedCrossCheckedCriteria > 0,
  )
})

test('publishes sourced candidates while withholding internal claim fields and private sources', () => {
  const profiles = fixture()
  const podium = profiles.find((product) => product.id === 'podium')
  const candidate = podium.claims.find(
    (claim) =>
      claim.support !== 'unknown' &&
      claim.publication === 'public-reviewed' &&
      claim.contradictions.length === 0 &&
      claim.scope.surfaceIds.length &&
      claim.evidenceIds.every(
        (id) => podium.evidence.find((source) => source.id === id)?.visibility === 'public',
      ),
  )
  assert.ok(candidate)
  // A real finding made private by its state and its internal source.
  const internal = podium.claims.findLast(
    (claim) => claim !== candidate && claim.publication === 'public-reviewed',
  )
  internal.publication = 'internal-only'
  internal.review = null
  podium.evidence.push({
    ...podium.evidence[0],
    id: 'private-fixture-source',
    kind: 'documented',
    url: 'internal-file:fixture/private.md',
    visibility: 'internal',
    commit: null,
    path: null,
  })
  internal.evidenceIds.push('private-fixture-source')
  makeCandidate(candidate)
  candidate.answer = 'SOURCED-CANDIDATE-FINDING-SENTINEL'
  internal.answer = 'PRIVATE-ANSWER-SENTINEL'
  internal.unknownReason = 'PRIVATE-GAP-SENTINEL'
  internal.limitations = ['PRIVATE-LIMITATION-SENTINEL']
  internal.scope.version = 'PRIVATE-SCOPE-SENTINEL'
  Object.values(internal.subanswers)[0].answer = 'PRIVATE-ATOMIC-ANSWER-SENTINEL'
  for (const source of podium.evidence.filter((item) => item.visibility === 'internal'))
    source.finding = 'PRIVATE-SOURCE-SENTINEL'
  const result = buildPublicationFromProfiles(profiles, { date: fixtureDate })
  const serialized =
    JSON.stringify(result) + pairToMarkdown(result.pairs[0]) + indexToMarkdown(result)
  assert.ok(serialized.includes(candidate.answer))
  assert.equal(serialized.includes('PRIVATE-'), false)
  assert.equal(serialized.includes('internal-file:'), false)
  assert.ok(serialized.includes(publicationConfig.unpublishedClaimText))
  assert.equal(claimById(result.pairs[0], internal.id).verificationStatus, 'not-published')
  assert.equal(serialized.includes('publicationStatus'), false)
  assert.equal(serialized.includes('public-reviewed'), false)
  assert.equal(serialized.includes('public-candidate'), false)
})

test('expiry removes findings while retaining pairs and never refreshes source dates', () => {
  const profiles = fixture()
  const claim = profiles[0].claims.find((item) => item.publication === 'public-reviewed')
  const dueDate = claim.nextReviewAt
  assert.equal(
    claimById(buildPublicationFromProfiles(profiles, { date: dueDate }).pairs[0], claim.id)
      .verificationStatus,
    'agent-cross-checked',
  )
  const expired = buildPublicationFromProfiles(profiles, { date: '2099-01-01' })
  assert.equal(expired.pairs.length, 1)
  assert.ok(claimsOf(expired.pairs[0]).every((item) => item.verificationStatus === 'not-published'))
  assert.equal(expired.pairs[0].sources.length, 0)
  assert.equal(expired.pairs[0].lastCrossCheckedAt, null)
  assert.equal(expired.pairs[0].nextCheckAt, null)
  assert.equal(claim.nextReviewAt, dueDate)
})

test('does not publish checks, cross-checks or evidence dated after the build', () => {
  const profiles = fixture()
  const claim = profiles[0].claims.find((item) => item.publication === 'public-reviewed')
  const buildDate = '2026-01-01'
  const statusAtBuild = () =>
    claimById(buildPublicationFromProfiles(profiles.map(bindFixtureReviews), { date: buildDate }).pairs[0], claim.id)
      .verificationStatus
  assert.equal(statusAtBuild(), 'not-published')

  // Each date alone must block: the others stay on or before the build.
  for (const id of citedEvidenceIds(claim)) {
    profiles[0].evidence.find((item) => item.id === id).retrievedAt = buildDate
  }
  claim.checkedAt = buildDate
  claim.review.date = buildDate
  assert.equal(statusAtBuild(), 'agent-cross-checked')
  claim.review.date = fixtureDate
  assert.equal(statusAtBuild(), 'not-published')
  claim.review.date = buildDate
  claim.checkedAt = '2025-12-31'
  profiles[0].evidence.find((item) => item.id === claim.evidenceIds[0]).retrievedAt = fixtureDate
  assert.equal(statusAtBuild(), 'not-published')
})

test('a newer claim check needs a cited source recheck', () => {
  const profiles = fixture()
  const profile = profiles.find((product) => product.id === 'conductor')
  const claim = profile.claims.find((item) => item.publication === 'public-reviewed')
  assert.equal(
    claimById(buildPublicationFromProfiles(profiles, { date: fixtureDate }).pairs[0], claim.id)
      .verificationStatus,
    'agent-cross-checked',
  )
  const latestSourceCheck = profile.evidence
    .filter((evidence) => claim.evidenceIds.includes(evidence.id))
    .map((evidence) => evidence.retrievedAt)
    .sort()
    .at(-1)
  const recheckDate = new Date(`${latestSourceCheck}T00:00:00Z`)
  recheckDate.setUTCDate(recheckDate.getUTCDate() + 1)
  const newerDate = recheckDate.toISOString().slice(0, 10)
  claim.checkedAt = newerDate
  claim.review.date = newerDate
  claim.nextReviewAt = newerDate
  bindFixtureReviews(profile)
  assert.equal(
    claimById(buildPublicationFromProfiles(profiles, { date: newerDate }).pairs[0], claim.id)
      .verificationStatus,
    'not-published',
  )
})

test('candidate contradictions, private evidence and missing scope gate individual findings', () => {
  for (const mutate of [
    (claim) => {
      claim.contradictions = ['Conflicting public documentation.']
    },
    (claim) => {
      claim.scope.surfaceIds = []
    },
    (claim, profile) => {
      profile.evidence.find((source) => source.id === claim.evidenceIds[0]).visibility = 'internal'
    },
  ]) {
    const profiles = fixture()
    const profile = profiles.find((product) => product.id === 'conductor')
    for (const claim of profile.claims)
      if (claim.publication === 'public-reviewed') makeCandidate(claim)
    const claim = profile.claims.find(
      (item) => item.publication === 'public-candidate' && item.support !== 'unknown',
    )
    mutate(claim, profile)
    const result = buildPublicationFromProfiles(profiles, { date: fixtureDate })
    assert.equal(result.pairs.length, 1)
    assert.equal(claimById(result.pairs[0], claim.id).verificationStatus, 'not-published')
    assert.ok(
      claimsOf(result.pairs[0]).some((item) => item.verificationStatus === 'agent-cross-checked'),
    )
  }
})

test('rejects a review by the original researcher', () => {
  const profiles = fixture()
  const claim = profiles[0].claims.find((item) => item.publication === 'public-reviewed')
  claim.review.reviewer = claim.researcher
  assert.throws(
    () => buildPublicationFromProfiles(profiles, { date: fixtureDate }),
    /reviewer must be independent/,
  )
})

test('edited claims and cited evidence cannot keep an earlier agent cross-check', () => {
  for (const mutate of [
    (profile, claim) => claim.answer = 'Edited after independent review.',
    (profile, claim) => Object.values(claim.subanswers)[0].answer = 'Edited atomic answer.',
    (profile, claim) => claim.scope.version = 'Changed release',
    (profile, claim) => profile.evidence.find(item => item.id === claim.evidenceIds[0]).finding = 'Edited evidence.',
    (profile, claim) => delete claim.review.contentHash,
  ]) {
    const profiles = fixture(), profile = profiles[0]
    const claim = profile.claims.find(item => item.review)
    mutate(profile, claim)
    assert.throws(() => buildPublicationFromProfiles(profiles, { date: fixtureDate }), /content hash differs|allowed shape/)
  }
  const profiles = fixture(), claim = profiles[0].claims.find(item => item.review)
  makeCandidate(claim)
  claim.answer = 'Edited finding awaiting another independent review.'
  const result = buildPublicationFromProfiles(profiles, { date: fixtureDate })
  assert.equal(claimById(result.pairs[0], claim.id).verificationStatus, 'sourced')
  assert.equal(claimById(result.pairs[0], claim.id).crossCheckedAt, null)
  assert.equal(JSON.stringify(result).includes('contentHash'), false)
})

test('adds every pair for a full profile without publishable findings', () => {
  const profiles = fixture()
  const clone = structuredClone(profiles[0])
  clone.id = 'new-tool'
  clone.name = 'New Tool'
  clone.changes = []
  clone.claims = clone.claims.map((claim) => ({
    ...claim,
    id: `new-tool:${claim.criterionId}`,
    publication: 'internal-only',
    review: null,
  }))
  const result = buildPublicationFromProfiles([...profiles, clone], { date: fixtureDate })
  assert.deepEqual(
    result.pairs.map((pair) => pair.slug),
    ['conductor-vs-new-tool', 'conductor-vs-podium', 'new-tool-vs-podium'],
  )
  assert.ok(
    result.pairs
      .filter((pair) => pair.slug.includes('new-tool'))
      .every((pair) => pair.coverage.sharedSourcedCriteria === 0),
  )
})

test('exports only public namespaced evidence cited by candidates or reviewed findings', () => {
  assert.ok(stagedPublication.pairs.every((pair) => pair.sources.length > 0))
  for (const pair of [...publication.pairs, ...stagedPublication.pairs]) {
    const referenced = new Set(
      [...pair.products.flatMap(product => product.lifecycle.evidenceIds ?? []), ...claimsOf(pair).flatMap((claim) => [
        ...claim.evidenceIds,
        ...claim.questions.flatMap((question) => question.evidenceIds),
      ])],
    )
    assert.deepEqual(new Set(pair.sources.map((source) => source.id)), referenced)
    for (const source of pair.sources) {
      assert.ok(source.id.startsWith(`${source.productId}:`))
      assert.match(source.url, /^https?:\/\//)
      const profile = products.find((product) => product.id === source.productId)
      const original = profile.evidence.find((item) => `${profile.id}:${item.id}` === source.id)
      assert.equal(original.visibility, 'public')
      assert.notEqual(original.kind, 'unresolved')
    }
  }
})

test('Markdown and JSON contain the same candidate and reviewed findings', () => {
  const pairs = [
    stagedPublication.pairs.find((pair) => pair.slug === 'conductor-vs-podium'),
    stagedPublication.pairs.find((pair) => pair.slug === 'orca-vs-superset'),
  ]
  const index = indexToMarkdown(stagedPublication)
  for (const pair of pairs) {
    const markdown = pairToMarkdown(pair)
    for (const criterion of pair.criteria) {
      assert.ok(markdown.includes(criterion.id))
      for (const claim of criterion.products) {
        assert.ok(markdown.includes(`(${claim.verificationStatus})`))
        assert.ok(markdown.includes(claim.answer))
        for (const question of claim.questions) assert.ok(markdown.includes(question.answer))
        for (const id of claim.evidenceIds) assert.ok(markdown.includes(id))
      }
    }
    assert.ok(markdown.includes('Availability:'))
    assert.ok(markdown.includes('source checks:'))
    assert.ok(markdown.includes('execution_modes='))
    assert.equal(markdown.includes('agent cross-checked null'), false)
    assert.ok(index.includes(pair.markdownUrl))
    assert.ok(index.includes(pair.dataUrl))
  }
})

const lifecycleFixture = () => {
  const profiles = ['local-tool', 'other-tool', 'third-tool'].map(id =>
    createUnknownProfile({ id, name: id }, { date: '2026-10-13' }))
  const profile = profiles[0]
  profile.evidence.push({ id: 'sunset-notice', kind: 'documented', url: 'https://example.com/shutdown',
    title: 'Service notice', locator: 'Service transition', sourceDate: '2026-10-01', retrievedAt: '2026-10-13',
    finding: 'The hosted service is sunsetting; local workspaces continue.', visibility: 'public', commit: null, path: null })
  profile.lifecycle = { status: 'sunset', note: 'Hosted service is sunsetting.', scope: 'Commercial hosted service',
    continuation: 'Local open-source workspaces continue.', announcementDate: '2026-10-01', serviceEndDate: null,
    checkedAt: '2026-10-13', nextReviewAt: '2026-10-27', evidenceIds: ['sunset-notice'],
    researcher: 'PRIVATE-RESEARCHER', publication: 'public-reviewed', contradictions: [], review: null }
  profile.lifecycle.review = { reviewer: 'PRIVATE-REVIEWER', date: '2026-10-13', contentHash: lifecycleReviewHash(profile) }
  return profiles
}

test('lifecycle-only evidence publishes with scoped notes in every pair without changing capabilities', () => {
  const profiles = lifecycleFixture()
  const result = buildPublicationFromProfiles(profiles, { date: '2026-10-13' })
  assert.equal(result.pairs.length, 3)
  const pair = result.pairs[0]
  const product = pair.products[0]
  assert.deepEqual(product.lifecycle, {
    status: 'sunset', note: 'Hosted service is sunsetting.', scope: 'Commercial hosted service',
    continuation: 'Local open-source workspaces continue.', announcementDate: '2026-10-01', serviceEndDate: null,
    checkedAt: '2026-10-13', crossCheckedAt: '2026-10-13', nextCheckAt: '2026-10-27',
    evidenceIds: ['local-tool:sunset-notice'],
  })
  assert.deepEqual(pair.products[1].lifecycle, { status: 'unknown', note: null })
  assert.equal(pair.coverage.sourcedCriterionRows, 0)
  assert.equal(pair.nextCheckAt, '2026-10-27')
  assert.equal(pair.lastCheckedAt, '2026-10-13')
  assert.equal(pair.lastCrossCheckedAt, '2026-10-13')
  assert.equal(pair.sources.length, 1)
  assert.equal(pair.sources[0].id, product.lifecycle.evidenceIds[0])
  const markdown = pairToMarkdown(pair)
  assert.ok(markdown.includes(lifecycleNotice(product)))
  const html = lifecycleToHtml(product)
  assert.ok(html.includes(lifecycleNotice(product)))
  assert.ok(html.includes('href="#source-local-tool:sunset-notice"'))
  assert.ok(html.includes('check again by 2026-10-27'))
  assert.equal(lifecycleToHtml(pair.products[1]), '')
  assert.ok(indexToMarkdown(result).includes(lifecycleNotice(product)))
  assert.ok(markdown.includes('local-tool:sunset-notice'))
  assert.ok(markdown.includes('https://example.com/shutdown'))
  assert.ok(markdown.includes('check again by 2026-10-27'))
  assert.equal(JSON.stringify(result).includes('PRIVATE-'), false)
  assert.equal(JSON.stringify(result).includes('contentHash'), false)
  assert.equal(JSON.stringify(result).includes('public-reviewed'), false)
  for (const pair of result.pairs) {
    assert.deepEqual(result.comparisons.find(item => item.slug === pair.slug).products, pair.products)
    assert.ok(claimsOf(pair).every(claim => claim.support === 'not-published'))
  }
})

test('lifecycle notices fail closed for private, unresolved, altered, unreviewed and future data', () => {
  for (const mutate of [
    p => delete p.lifecycle,
    p => p.lifecycle.publication = 'public-candidate',
    p => p.lifecycle.publication = 'internal-only',
    p => p.lifecycle.review = null,
    p => p.lifecycle.review.reviewer = p.lifecycle.researcher,
    p => p.lifecycle.review.date = '2026-10-14',
    p => p.lifecycle.checkedAt = '2026-10-14',
    p => p.lifecycle.note = 'PRIVATE-NOTICE',
    p => p.lifecycle.scope = 'PRIVATE-SCOPE',
    p => p.lifecycle.evidenceIds = ['missing'],
    p => p.lifecycle.contradictions = ['PRIVATE-CONFLICT'],
    p => p.evidence[0].visibility = 'internal',
    p => p.evidence[0].url = 'internal-file:private/path',
    p => p.evidence[0].url = 'https://secret:password@example.com',
    p => p.evidence[0].kind = 'unresolved',
    p => p.evidence[0].retrievedAt = '2026-10-14',
    p => p.evidence[0].sourceDate = '2026-10-14',
    p => p.evidence[0].retrievedAt = '2026-10-12',
    p => p.evidence[0].finding = 'Changed evidence',
  ]) {
    const p = lifecycleFixture()[0]
    mutate(p)
    assert.deepEqual(publicLifecycle(p, '2026-10-13'), { status: 'unknown', note: null })
  }
  const profiles = lifecycleFixture()
  profiles[0].lifecycle.publication = 'public-candidate'
  profiles[0].lifecycle.review = null
  profiles[0].lifecycle.note = 'PRIVATE-CANDIDATE-NOTICE'
  const candidate = buildPublicationFromProfiles(profiles, { date: '2026-10-13' })
  assert.equal(candidate.pairs.length, 3)
  assert.equal(JSON.stringify(candidate).includes('PRIVATE-'), false)
  assert.ok(candidate.pairs.every(pair => pair.sources.length === 0))
})

test('lifecycle expiration retains all pairs and drops only the notice and its exclusive sources', () => {
  const profiles = lifecycleFixture()
  assert.equal(publicLifecycle(profiles[0], '2026-10-27').status, 'sunset')
  const result = buildPublicationFromProfiles(profiles, { date: '2026-10-28' })
  assert.equal(result.pairs.length, 3)
  assert.ok(result.pairs.every(pair => pair.sources.length === 0 && pair.nextCheckAt === null))
  assert.ok(result.pairs.every(pair => pair.products.every(product => product.lifecycle.status === 'unknown')))
  assert.equal(pairToMarkdown(result.pairs[0]).includes('Hosted service is sunsetting'), false)
  assert.equal(profiles[0].lifecycle.nextReviewAt, '2026-10-27')
})

test('HTML lifecycle notes escape notice text and source anchors', () => {
  const product = { name: '<script>name</script>', lifecycle: { ...publicLifecycle(lifecycleFixture()[0], '2026-10-13'),
    note: '<img src=x onerror=alert(1)>', continuation: '<script>continuation</script>', evidenceIds: ['x" onclick="bad'] } }
  const html = lifecycleToHtml(product)
  assert.ok(html.includes('&lt;img'))
  assert.ok(html.includes('&quot; onclick=&quot;'))
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('<img'), false)
})

test('freshness and public evidence gates hold even with a newly recorded digest', () => {
  for (const mutate of [
    p => p.lifecycle.checkedAt = '2026-10-14',
    p => p.lifecycle.review.date = '2026-10-14',
    p => p.evidence[0].retrievedAt = '2026-10-14',
    p => p.evidence[0].retrievedAt = '2026-10-12',
    p => p.evidence[0].sourceDate = '2026-10-14',
    p => p.evidence[0].visibility = 'internal',
    p => p.evidence[0].kind = 'unresolved',
    p => p.lifecycle.contradictions = ['Conflicting public evidence.'],
  ]) {
    const p = lifecycleFixture()[0]
    mutate(p)
    p.lifecycle.review.contentHash = lifecycleReviewHash(p)
    assert.deepEqual(publicLifecycle(p, '2026-10-13'), { status: 'unknown', note: null })
  }
})

test('an expired lifecycle cannot remove shared evidence or alter a publishable feature', () => {
  const profiles = lifecycleFixture()
  const profile = profiles[0]
  const claim = profile.claims[0]
  profile.surfaces = [{ id: 'local', name: 'Local workspace', type: 'desktop' }]
  Object.assign(claim, { support: 'partial', answer: 'Local access is documented; other clients are unverified.',
    publication: 'public-candidate', checkedAt: '2026-10-13', nextReviewAt: '2026-11-01',
    evidenceIds: ['sunset-notice'], limitations: ['Other clients unverified.'] })
  claim.scope.surfaceIds = ['local']
  const current = buildPublicationFromProfiles(profiles, { date: '2026-10-13' }).pairs[0]
  const expired = buildPublicationFromProfiles(profiles, { date: '2026-10-28' }).pairs[0]
  assert.equal(current.sources.length, 1, 'shared evidence is deduplicated')
  assert.equal(expired.sources.length, 1, 'feature citation survives notice expiration')
  assert.deepEqual(claimById(expired, claim.id), claimById(current, claim.id))
  assert.deepEqual(expired.coverage, current.coverage)
  assert.equal(expired.nextCheckAt, '2026-11-01')
  assert.equal(expired.products[0].lifecycle.status, 'unknown')
})
