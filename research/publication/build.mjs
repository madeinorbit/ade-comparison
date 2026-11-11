import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { catalogDir, claimReviewHash, criteria, lifecycleErrors, loadProducts, rubric, validateProfile } from '../lib.mjs'

export const publicationConfig = JSON.parse(
  readFileSync(resolve(catalogDir, 'publication/config.json'), 'utf8'),
)

const normalizePath = (path) => (path.endsWith('/') ? path : `${path}/`)
const absoluteUrl = (path) => new URL(path, publicationConfig.baseUrl).href
const pairPath = (slug) => `${normalizePath(publicationConfig.basePath) + slug}/`

// ADE_COMPARISON_PUBLICATION_DATE fixes the snapshot date.
export const publicationDateVariables = ['ADE_COMPARISON_PUBLICATION_DATE']
export const publicationDateOverride = () => publicationDateVariables
  .map(name => [name, process.env[name]?.trim()]).find(([, value]) => value) ?? [publicationDateVariables[0], '']

export const publicationDate = () => {
  const [name, override] = publicationDateOverride()
  // Dates compare as text, so a value like "2026" would keep expired findings public.
  if (override && !/^\d{4}-\d{2}-\d{2}$/.test(override)) {
    throw new Error(`${name} must be YYYY-MM-DD`)
  }
  return override || new Date().toISOString().slice(0, 10)
}

const compareIds = (left, right) => left.id.localeCompare(right.id)

const referencedEvidenceIds = (claim) =>
  new Set([
    ...claim.evidenceIds,
    ...Object.values(claim.subanswers).flatMap((answer) => answer.evidenceIds),
  ])

const isPublicClaim = (profile, claim, date, directory) => {
  if (!['public-reviewed', 'public-candidate'].includes(claim.publication)) return false
  if (
    claim.publication === 'public-reviewed' &&
    (!claim.review ||
      claim.review.reviewer === claim.researcher ||
      claim.review.date < claim.checkedAt ||
      claim.review.contentHash !== claimReviewHash(profile, claim))
  )
    return false
  if (claim.checkedAt > date || (claim.review && claim.review.date > date)) return false
  if ((!directory && claim.nextReviewAt < date) || claim.contradictions.length > 0) return false
  if (claim.scope.surfaceIds.length === 0 || claim.support === 'unknown') return false

  const evidenceById = new Map(profile.evidence.map((item) => [item.id, item]))
  const ids = referencedEvidenceIds(claim)
  if (ids.size === 0) return false
  if (![...ids].some((id) => evidenceById.get(id)?.retrievedAt >= claim.checkedAt)) return false
  return [...ids].every((id) => {
    const evidence = evidenceById.get(id)
    return (
      evidence?.visibility === 'public' &&
      evidence.kind !== 'unresolved' &&
      evidence.retrievedAt <= date &&
      (!evidence.sourceDate || evidence.sourceDate <= date) &&
      /^https?:\/\//.test(evidence.url)
    )
  })
}

// Candidate shutdown notices need an announcement on the product's own site or
// repository. Sharing a hosting provider alone does not establish ownership.
const firstPartySource = (profile, sourceUrl) => {
  const source = new URL(sourceUrl)
  const repository = profile.identity.repository && new URL(profile.identity.repository)
  if (repository && source.origin === repository.origin &&
    (source.pathname === repository.pathname || source.pathname.startsWith(`${repository.pathname.replace(/\/$/, '')}/`))) return true
  const website = profile.identity.website && new URL(profile.identity.website)
  if (!website) return false
  const host = website.hostname.replace(/^www\./, '')
  // Multi-tenant repository and site hosts require a matching product path.
  if (['github.com', 'gitlab.com', 'bitbucket.org'].includes(host)) {
    return source.origin === website.origin && (source.pathname === website.pathname || source.pathname.startsWith(`${website.pathname.replace(/\/$/, '')}/`))
  }
  return source.hostname === host || source.hostname.endsWith(`.${host}`)
}

export function publicLifecycle(profile, date = publicationDate(), { allowOverdue = false, allowSourced = false } = {}) {
  const lifecycle = profile.lifecycle
  const reviewed = lifecycle?.publication === 'public-reviewed'
  if (!lifecycle || lifecycle.status !== 'sunset' ||
    !(reviewed || allowSourced && lifecycle.publication === 'public-candidate') ||
    lifecycleErrors(profile, { publicationDate: date, allowOverdue, allowSourced }).length ||
    (!reviewed && !profile.evidence.some(source => lifecycle.evidenceIds.includes(source.id) && firstPartySource(profile, source.url)))) {
    return { status: 'unknown', note: null }
  }
  return {
    status: lifecycle.status,
    note: lifecycle.note,
    scope: lifecycle.scope,
    continuation: lifecycle.continuation,
    announcementDate: lifecycle.announcementDate,
    serviceEndDate: lifecycle.serviceEndDate,
    checkedAt: lifecycle.checkedAt,
    crossCheckedAt: reviewed ? lifecycle.review.date : null,
    nextCheckAt: lifecycle.nextReviewAt,
    evidenceIds: lifecycle.evidenceIds.map(id => `${profile.id}:${id}`),
  }
}

export const lifecycleNotice = (product) => {
  if (product.lifecycle.status !== 'sunset') return null
  const scope = product.lifecycle.scope.trim()
  const punctuation = /[.!?]$/.test(scope) ? '' : '.'
  return `${product.name} lifecycle: sunset. ${product.lifecycle.note} Scope: ${scope}${punctuation}${product.lifecycle.continuation ? ` Continuation: ${product.lifecycle.continuation}` : ''}`
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

export function lifecycleToHtml(product) {
  if (product.lifecycle.status !== 'sunset') return ''
  const lifecycle = product.lifecycle
  const sources = lifecycle.evidenceIds.map(id => `<a href="#source-${escapeHtml(id)}">${escapeHtml(id)}</a>`).join(', ')
  return `<aside class="lifecycle-notice" aria-label="${escapeHtml(product.name)} lifecycle notice"><p>${escapeHtml(lifecycleNotice(product))}</p><p class="source-ids">Checked ${escapeHtml(lifecycle.checkedAt)}; agent cross-checked ${escapeHtml(lifecycle.crossCheckedAt)}; check again by ${escapeHtml(lifecycle.nextCheckAt)}. Sources: ${sources}.</p></aside>`
}

const publicProduct = (profile, claims, date, directory = false) => ({
  id: profile.id,
  name: profile.name,
  website: profile.identity.website,
  repository: profile.identity.repository,
  lifecycle: publicLifecycle(profile, date, { allowOverdue: directory, allowSourced: directory }),
  surfaces: profile.surfaces.map(({ id, name, type }) => ({ id, name, type })),
  sourcedClaimCount: claims.size,
  crossCheckedClaimCount: [...claims.values()].filter(
    (claim) => claim.verificationStatus === 'agent-cross-checked',
  ).length,
  sourcedOnlyClaimCount: [...claims.values()].filter(
    (claim) => claim.verificationStatus === 'sourced',
  ).length,
  oldestCheckedAt: [...claims.values()].map((claim) => claim.checkedAt).sort()[0] ?? null,
  lastCheckedAt:
    [...claims.values()]
      .map((claim) => claim.checkedAt)
      .sort()
      .at(-1) ?? null,
})

const publicEvidence = (productId, evidence) => ({
  id: `${productId}:${evidence.id}`,
  productId,
  kind: evidence.kind,
  url: evidence.url,
  title: evidence.title,
  locator: evidence.locator,
  sourceDate: evidence.sourceDate,
  retrievedAt: evidence.retrievedAt,
  finding: evidence.finding,
  ...(evidence.kind === 'source-inspected' ? { commit: evidence.commit, path: evidence.path } : {}),
  ...(evidence.kind === 'observed'
    ? {
        method: evidence.method,
        configuration: evidence.configuration,
        fixture: evidence.fixture,
        result: evidence.result,
      }
    : {}),
})

const publicClaim = (profile, claim, criterion) => {
  const evidenceIds = referencedEvidenceIds(claim)
  const evidence = profile.evidence
    .filter((item) => evidenceIds.has(item.id))
    .map((item) => publicEvidence(profile.id, item))

  return {
    productId: profile.id,
    claimId: claim.id,
    verificationStatus: claim.publication === 'public-reviewed' ? 'agent-cross-checked' : 'sourced',
    support: claim.support,
    answer: claim.answer,
    availability: claim.availability,
    delivery: claim.delivery,
    scope: {
      ...claim.scope,
      surfaces: claim.scope.surfaceIds.map((surfaceId) => {
        const surface = profile.surfaces.find((item) => item.id === surfaceId)
        return surface
          ? { id: surface.id, name: surface.name, type: surface.type }
          : { id: surfaceId }
      }),
    },
    questions: criterion.subquestions.map((question) => {
      const answer = claim.subanswers[question.id]
      return {
        id: question.id,
        question: question.question,
        support: answer.support,
        answer: answer.answer,
        evidenceIds: answer.evidenceIds.map((id) => `${profile.id}:${id}`),
      }
    }),
    limitations: claim.limitations,
    checkedAt: claim.checkedAt,
    crossCheckedAt: claim.publication === 'public-reviewed' ? claim.review.date : null,
    nextCheckAt: claim.nextReviewAt,
    evidenceIds: claim.evidenceIds.map((id) => `${profile.id}:${id}`),
    evidence,
  }
}

const unpublishedClaim = (productId, criterion) => ({
  productId,
  claimId: `${productId}:${criterion.id}`,
  verificationStatus: 'not-published',
  support: 'not-published',
  answer: publicationConfig.unpublishedClaimText,
  availability: null,
  delivery: null,
  scope: null,
  questions: [],
  limitations: [],
  checkedAt: null,
  crossCheckedAt: null,
  nextCheckAt: null,
  evidenceIds: [],
  evidence: [],
})

const makePair = (leftProfile, rightProfile, freshByProduct, date) => {
  const profiles = [leftProfile, rightProfile].sort(compareIds)
  const slug = `${profiles[0].id}-vs-${profiles[1].id}`
  const products = profiles.map((profile) => publicProduct(profile, freshByProduct.get(profile.id), date))
  const rows = criteria.map((criterion) => ({
    id: criterion.id,
    title: criterion.title,
    group: criterion.group,
    judgment: criterion.judgment,
    questions: criterion.subquestions,
    products: profiles.map((profile) => {
      const claim = freshByProduct.get(profile.id).get(criterion.id)
      return claim ?? unpublishedClaim(profile.id, criterion)
    }),
  }))
  const crossCheckedClaims = rows
    .flatMap((row) => row.products)
    .filter((claim) => claim.verificationStatus === 'agent-cross-checked')
  const sourcedClaims = rows
    .flatMap((row) => row.products)
    .filter((claim) => claim.verificationStatus !== 'not-published')
  const sources = [
    ...new Map(
      [...sourcedClaims.flatMap((claim) => claim.evidence),
        ...profiles.flatMap(profile => {
          const lifecycle = products.find(product => product.id === profile.id).lifecycle
          return profile.evidence.filter(item => lifecycle.evidenceIds?.includes(`${profile.id}:${item.id}`))
            .map(item => publicEvidence(profile.id, item))
        }),
      ].map((item) => [item.id, item]),
    ).values(),
  ]
  const sharedCrossCheckedCriteria = rows.filter((row) =>
    row.products.every((claim) => claim.verificationStatus === 'agent-cross-checked'),
  ).length
  const sharedSourcedCriteria = rows.filter((row) =>
    row.products.every((claim) => claim.verificationStatus !== 'not-published'),
  ).length
  const lifecycleFindings = products.map(product => product.lifecycle).filter(item => item.status === 'sunset')
  const nextCheckAt = [...sourcedClaims, ...lifecycleFindings].map((claim) => claim.nextCheckAt).sort()[0] ?? null
  const lastCheckedAt =
    [...sourcedClaims, ...lifecycleFindings]
      .map((claim) => claim.checkedAt)
      .sort()
      .at(-1) ?? null
  const lastCrossCheckedAt =
    [...crossCheckedClaims, ...lifecycleFindings]
      .map((claim) => claim.crossCheckedAt)
      .sort()
      .at(-1) ?? null
  const path = pairPath(slug)

  return {
    schemaVersion: publicationConfig.schemaVersion,
    rubricVersion: rubric.rubricVersion,
    slug,
    canonicalUrl: absoluteUrl(path),
    markdownUrl: absoluteUrl(`${path}index.md`),
    dataUrl: absoluteUrl(`${path}data.json`),
    generatedAt: date,
    lastCheckedAt,
    lastCrossCheckedAt,
    nextCheckAt,
    publisher: publicationConfig.publisher,
    products,
    coverage: {
      totalCriteria: criteria.length,
      sharedCrossCheckedCriteria,
      sharedSourcedCriteria,
      crossCheckedCriteriaByProduct: Object.fromEntries(
        products.map((product) => [product.id, product.crossCheckedClaimCount]),
      ),
      sourcedOnlyCriteriaByProduct: Object.fromEntries(
        products.map((product) => [product.id, product.sourcedOnlyClaimCount]),
      ),
      sourcedCriteriaByProduct: Object.fromEntries(
        products.map((product) => [product.id, product.sourcedClaimCount]),
      ),
      crossCheckedCriterionRows: rows.filter((row) =>
        row.products.some((claim) => claim.verificationStatus === 'agent-cross-checked'),
      ).length,
      sourcedOnlyCriterionRows: rows.filter((row) =>
        row.products.some((claim) => claim.verificationStatus === 'sourced'),
      ).length,
      sourcedCriterionRows: rows.filter((row) =>
        row.products.some((claim) => claim.verificationStatus !== 'not-published'),
      ).length,
    },
    criteria: rows.map((row) => ({
      ...row,
      products: row.products.map(({ evidence: _evidence, ...claim }) => claim),
    })),
    sources,
  }
}

// History is private prose. Publish only an event's type, date and references
// that still resolve to current public findings. Never copy summary/before/after.
const publicChanges = (profile, claims, lifecycle, date) => {
  const claimById = new Map([...claims.values()].map(claim => [claim.claimId, claim]))
  const claimSources = claim => [...claim.evidenceIds, ...claim.questions.flatMap(q => q.evidenceIds)]
  return profile.changes.flatMap((change, index) => {
    if (change.date > date) return []
    const claimIds = change.claimIds.filter(id => claimById.has(id))
    const allowed = new Set(claimIds.flatMap(id => claimSources(claimById.get(id))))
    if (!change.claimIds.length) for (const id of lifecycle.evidenceIds ?? []) allowed.add(id)
    const evidenceIds = (change.evidenceIds ?? []).map(id => `${profile.id}:${id}`)
      .filter(id => allowed.has(id))
    if (!evidenceIds.length || (!claimIds.length && lifecycle.status !== 'sunset')) return []
    return [{ id: `${profile.id}:${change.date}:${index}`, productId: profile.id,
      date: change.date, type: change.type, claimIds, evidenceIds }]
  })
}

// GitHub stars are dated repository attention, not users or capability. Publish
// a count only with a public source on the product's own repository, so a
// third-party list or an unsourced number never reaches the site.
const repositorySlug = url => {
  const parsed = new URL(url)
  const parts = parsed.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
  if (parsed.protocol !== 'https:') return null
  if (parsed.hostname === 'github.com' && parts.length >= 2) return `${parts[0]}/${parts[1]}`.toLowerCase()
  if (parsed.hostname === 'api.github.com' && parts[0] === 'repos' && parts.length >= 3) return `${parts[1]}/${parts[2]}`.toLowerCase()
  return null
}
export function publicGithubStars(profile, date = publicationDate()) {
  const stars = profile.context?.marketContext?.githubStars
  const repository = profile.identity.repository && repositorySlug(profile.identity.repository)
  if (!repository || !Number.isInteger(stars?.value) || stars.value < 0 || !stars.evidenceIds?.length) return null
  const sources = stars.evidenceIds.map(id => profile.evidence.find(item => item.id === id))
  if (sources.some(source => !source || source.visibility !== 'public' || source.kind === 'unresolved' ||
    source.retrievedAt > date || repositorySlug(source.url) !== repository)) return null
  const observedAt = stars.observedAt ?? sources.map(source => source.retrievedAt).sort().at(-1)
  if (observedAt > date) return null
  return { value: stars.value, observedAt, evidenceIds: stars.evidenceIds.map(id => `${profile.id}:${id}`) }
}

const publicProductRecord = (profile, claims, date, directory) => {
  const product = publicProduct(profile, claims, date, directory)
  const evidenceIds = new Set([...claims.values()].flatMap(claim => claim.evidence.map(e => e.id)))
  for (const id of product.lifecycle.evidenceIds ?? []) evidenceIds.add(id)
  const githubStars = directory ? publicGithubStars(profile, date) : null
  for (const id of githubStars?.evidenceIds ?? []) evidenceIds.add(id)
  return { ...product, ...(githubStars ? { githubStars } : {}),
    claims: [...claims.values()].map(({ evidence: _evidence, ...claim }) => claim),
    sources: profile.evidence.filter(item => evidenceIds.has(`${profile.id}:${item.id}`))
      .map(item => publicEvidence(profile.id, item)),
    changes: publicChanges(profile, claims, product.lifecycle, date),
  }
}

// The directory retains overdue receipts and shows their age. Pair exports keep
// their existing freshness contract unless a separate policy is approved.
export function buildPublicationFromProfiles(profiles, { date = publicationDate(), format = 'pairs', registry = [], directory = false } = {}) {
  if (directory && format !== 'products') throw new Error('The directory policy requires products format')
  const errors = profiles.flatMap((profile) => validateProfile(profile))
  if (errors.length > 0) throw new Error(`Catalog validation failed:\n${errors.join('\n')}`)

  const fullProfiles = profiles
    .filter((profile) => profile.researchTier === 'full-profile')
    .sort(compareIds)
  const freshByProduct = new Map(
    fullProfiles.map((profile) => [
      profile.id,
      new Map(
        profile.claims
          .filter((claim) => isPublicClaim(profile, claim, date, directory))
          .map((claim) => [
            claim.criterionId,
            publicClaim(
              profile,
              claim,
              criteria.find((criterion) => criterion.id === claim.criterionId),
            ),
          ]),
      ),
    ]),
  )
  if (format === 'products') {
    return {
      schemaVersion: publicationConfig.schemaVersion,
      rubricVersion: rubric.rubricVersion,
      generatedAt: date,
      publisher: publicationConfig.publisher,
      products: fullProfiles.map(profile => publicProductRecord(profile, freshByProduct.get(profile.id), date, directory)),
      // Register entries are leads, not evidence. Keep the public identity only.
      listings: registry.map(item => ({ id: item.id, name: item.name, website: item.sources?.[0] ?? null })),
    }
  }
  if (format !== 'pairs') throw new Error(`Unknown publication format: ${format}`)
  const pairs = []
  for (let left = 0; left < fullProfiles.length; left += 1) {
    for (let right = left + 1; right < fullProfiles.length; right += 1) {
      pairs.push(makePair(fullProfiles[left], fullProfiles[right], freshByProduct, date))
    }
  }

  const products = fullProfiles.map((profile) =>
    publicProduct(profile, freshByProduct.get(profile.id), date),
  )
  const indexPath = normalizePath(publicationConfig.basePath)
  return {
    schemaVersion: publicationConfig.schemaVersion,
    rubricVersion: rubric.rubricVersion,
    canonicalUrl: absoluteUrl(indexPath),
    markdownUrl: absoluteUrl(`${indexPath}index.md`),
    dataUrl: absoluteUrl(`${indexPath}index.json`),
    llmsUrl: absoluteUrl(`${indexPath}llms.txt`),
    methodologyUrl: absoluteUrl(`${indexPath}methodology/`),
    generatedAt: date,
    publisher: publicationConfig.publisher,
    eligibility: { researchTier: 'full-profile', pairing: 'all-pairs' },
    coverage: {
      fullProfileProducts: products.length,
      pairCount: pairs.length,
      sourcedClaimCount: products.reduce((total, product) => total + product.sourcedClaimCount, 0),
      crossCheckedClaimCount: products.reduce(
        (total, product) => total + product.crossCheckedClaimCount,
        0,
      ),
      sourcedOnlyClaimCount: products.reduce(
        (total, product) => total + product.sourcedOnlyClaimCount,
        0,
      ),
    },
    comparisons: pairs.map(({ criteria: _criteria, sources: _sources, ...pair }) => pair),
    omittedProducts: [],
    pairs,
  }
}

export const buildPublication = (options = {}) => buildPublicationFromProfiles(loadProducts(), {
  ...options,
  registry: options.format === 'products'
    ? JSON.parse(readFileSync(resolve(catalogDir, 'registry.json'), 'utf8')).products : [],
})

const yamlValue = (value) => JSON.stringify(value)
const checkWindow = (product) =>
  product.oldestCheckedAt === null
    ? 'no sourced finding'
    : product.oldestCheckedAt === product.lastCheckedAt
      ? product.lastCheckedAt
      : `${product.oldestCheckedAt} to ${product.lastCheckedAt}`

export function pairToMarkdown(pair) {
  const [left, right] = pair.products
  const groups = [
    ...new Map(criteria.map((criterion) => [criterion.group.id, criterion.group])).values(),
  ]
  const lines = [
    '---',
    `schema_version: ${pair.schemaVersion}`,
    `rubric_version: ${yamlValue(pair.rubricVersion)}`,
    `canonical_url: ${yamlValue(pair.canonicalUrl)}`,
    `data_url: ${yamlValue(pair.dataUrl)}`,
    `generated_at: ${pair.generatedAt}`,
    `last_checked_at: ${pair.lastCheckedAt}`,
    `last_cross_checked_at: ${pair.lastCrossCheckedAt}`,
    `next_check_at: ${pair.nextCheckAt}`,
    `publisher: ${yamlValue(pair.publisher.name)}`,
    '---',
    '',
    `# ${left.name} vs ${right.name}`,
    '',
    `> ${pair.publisher.disclosure}`,
    '',
    ...pair.products.filter(product => product.lifecycle.status === 'sunset').flatMap(product => [
      `> ${lifecycleNotice(product)} Checked ${product.lifecycle.checkedAt}; agent cross-checked ${product.lifecycle.crossCheckedAt}; check again by ${product.lifecycle.nextCheckAt}. Sources: ${product.lifecycle.evidenceIds.join(', ')}.`,
      '',
    ]),
    `This comparison has ${pair.coverage.sharedSourcedCriteria} criteria with sourced findings for both products, including ${pair.coverage.sharedCrossCheckedCriteria} that a second agent cross-checked for both. ${pair.coverage.sourcedCriterionRows} criteria have a sourced finding for at least one product. "Sourced" findings passed publication validation. "Agent cross-checked" findings also received a separate agent source pass, not necessarily a hands-on test. Humans approve the rubric, templates and prototype; they do not review every finding. It does not declare a winner. A missing sourced finding is not evidence that a capability is absent.`,
    '',
    ...pair.products.map((product) => `- ${product.name} source checks: ${checkWindow(product)}.`),
    '',
    `- Canonical HTML: ${pair.canonicalUrl}`,
    `- Machine-readable JSON: ${pair.dataUrl}`,
    `- Methodology: ${new URL('methodology/', publicationConfig.baseUrl + normalizePath(publicationConfig.basePath)).href}`,
    '',
  ]

  for (const group of groups) {
    lines.push(`## ${group.name}`, '')
    for (const criterion of pair.criteria.filter((item) => item.group.id === group.id)) {
      lines.push(
        `### ${criterion.id}: ${criterion.title}`,
        '',
        `Judgment rule: ${criterion.judgment}`,
        '',
      )
      for (const claim of criterion.products) {
        const product = pair.products.find((item) => item.id === claim.productId)
        const statusLabel = {
          'agent-cross-checked': 'Agent cross-checked',
          sourced: 'Sourced',
          'not-published': 'No sourced public finding',
        }[claim.verificationStatus]
        lines.push(
          `#### ${product.name}`,
          '',
          `Verification status: ${statusLabel} (${claim.verificationStatus})`,
          `Support: ${claim.support}`,
          '',
          claim.answer,
          '',
        )
        if (claim.scope) {
          const scopeParts = [
            `surfaces=${claim.scope.surfaces.map((surface) => surface.name ?? surface.id).join(', ') || 'not specified'}`,
            `version=${claim.scope.version ?? 'not specified'}`,
            `plan=${claim.scope.plan ?? 'not specified'}`,
            `os=${claim.scope.os.join(', ') || 'not specified'}`,
            `execution_modes=${claim.scope.executionModes.join(', ') || 'not specified'}`,
            `region=${claim.scope.region ?? 'not specified'}`,
            `harness=${claim.scope.harness ?? 'not specified'}`,
          ]
          lines.push(
            `Availability: ${claim.availability ?? 'not published'}`,
            `Delivery: ${claim.delivery ?? 'not published'}`,
            `Scope: ${scopeParts.join('; ')}.`,
            '',
          )
        }
        if (claim.limitations.length > 0) {
          lines.push('Limitations:', ...claim.limitations.map((item) => `- ${item}`), '')
        }
        for (const question of claim.questions) {
          const citations =
            question.evidenceIds.length > 0 ? ` Sources: ${question.evidenceIds.join(', ')}.` : ''
          lines.push(
            `- ${question.id} — ${question.question} [${question.support}]: ${question.answer}${citations}`,
          )
        }
        if (claim.questions.length > 0) lines.push('')
        if (claim.checkedAt) {
          const crossCheckText =
            claim.verificationStatus === 'agent-cross-checked'
              ? `agent cross-checked ${claim.crossCheckedAt}`
              : 'not separately cross-checked'
          lines.push(
            `Checked ${claim.checkedAt}; ${crossCheckText}; check again by ${claim.nextCheckAt}.`,
            '',
          )
        }
        if (claim.evidenceIds.length > 0) lines.push(`Sources: ${claim.evidenceIds.join(', ')}`, '')
      }
    }
  }

  lines.push('## Sources', '')
  for (const source of pair.sources) {
    lines.push(
      `### ${source.id}`,
      '',
      `${source.title}. ${source.finding}`,
      '',
      `- URL: ${source.url}`,
      `- Locator: ${source.locator}`,
      `- Evidence kind: ${source.kind}`,
      `- Source date: ${source.sourceDate ?? 'Not stated'}`,
      `- Retrieved: ${source.retrievedAt}`,
    )
    if (source.kind === 'source-inspected')
      lines.push(`- Commit: ${source.commit}`, `- Path: ${source.path}`)
    if (source.kind === 'observed')
      lines.push(
        `- Method: ${source.method}`,
        `- Configuration: ${source.configuration}`,
        `- Fixture: ${source.fixture}`,
        `- Result: ${source.result}`,
      )
    lines.push('')
  }
  return `${lines.join('\n').trim()}\n`
}

export function indexToMarkdown(publication) {
  const lines = [
    '# Agent-readable ADE comparisons',
    '',
    `> Evidence-backed comparisons of agent development environments. ${publication.publisher.disclosure}`,
    '',
    `Generated ${publication.generatedAt}. Every pair of full-profile products appears, including pairs without shared sourced findings. "Sourced" findings passed publication validation. "Agent cross-checked" findings also received a separate agent source pass, not necessarily a hands-on test. Humans approve the rubric, templates and prototype; they do not review every finding. Missing sourced findings do not establish that a capability is absent.`,
    '',
    '## Comparisons',
    '',
  ]
  for (const pair of publication.comparisons) {
    const names = pair.products.map((product) => product.name).join(' vs ')
    const productDates = pair.products
      .map((product) => `${product.name}: ${checkWindow(product)}`)
      .join('; ')
    const notices = pair.products.map(lifecycleNotice).filter(Boolean).join(' ')
    lines.push(
      `- [${names}](${pair.markdownUrl}): ${pair.coverage.sharedSourcedCriteria} shared sourced criteria; ${pair.coverage.sharedCrossCheckedCriteria} shared agent-cross-checked criteria; source checks ${productDates}; ${pair.nextCheckAt ? `next source check due ${pair.nextCheckAt}` : 'no sourced findings published'}. JSON: ${pair.dataUrl}${notices ? ` ${notices}` : ''}`,
    )
  }
  lines.push(
    '',
    '## Reference',
    '',
    `- [Publication methodology](${publication.methodologyUrl})`,
    `- [Comparison index as JSON](${publication.dataUrl})`,
  )
  return `${lines.join('\n').trim()}\n`
}
