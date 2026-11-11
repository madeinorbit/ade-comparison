// Regenerates notes/review.json from the canonical product profiles.
//
//   ADE_COMPARISON_PUBLICATION_DATE=YYYY-MM-DD node research/notes/review-summary.mjs [--check]
//
// Every count, claim list and the data hash come from research/products/*.json and the
// publication gate on the given date. The file carries no hand-written per-product notes,
// so it treats every product the same way and cannot drift from the profiles.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadProducts, rubric } from '../lib.mjs'
import { buildPublicationFromProfiles, publicationDate } from '../publication/build.mjs'

const output = fileURLToPath(new URL('./review.json', import.meta.url))
const registry = JSON.parse(readFileSync(new URL('../registry.json', import.meta.url), 'utf8')).products

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value

export function reviewSummary(date = publicationDate(), profiles = loadProducts()) {
  const full = profiles.filter(profile => profile.researchTier === 'full-profile')
  const claims = full.flatMap(profile => profile.claims)
  const evidence = full.flatMap(profile => profile.evidence)
  const publication = buildPublicationFromProfiles(profiles, { date, format: 'products', registry, directory: true })
  const published = publication.products.flatMap(product => product.claims)
  const sourcedOnly = published.filter(claim => claim.verificationStatus === 'sourced').map(claim => claim.claimId).sort()
  const crossChecked = published.filter(claim => claim.verificationStatus === 'agent-cross-checked')
  const contradicted = claims.filter(claim => claim.contradictions.length).map(claim => claim.id).sort()
  const awaitingReview = claims.filter(claim => claim.support !== 'unknown' && claim.publication === 'public-candidate').map(claim => claim.id).sort()
  const roadmaps = full.map(profile => profile.context?.roadmapReview).filter(review => review?.checkedAt)
  const dataHash = createHash('sha256')
    .update(JSON.stringify(canonical([...profiles].sort((a, b) => a.id.localeCompare(b.id))))).digest('hex')
  return {
    date,
    rubricVersion: rubric.rubricVersion,
    dataHash,
    dataHashMethod: 'SHA-256 of the key-sorted JSON array of research/products/*.json profiles in ID order.',
    status: 'Generated from the canonical product profiles. Counts and claim lists describe the catalog and the publication gate on this date; per-product review history lives in each profile\'s change records.',
    coverage: {
      fullProfiles: full.length,
      documentedSourcePasses: full.filter(profile => ['documented', 'reviewed'].includes(profile.researchState)).length,
      criterionRecords: claims.length,
      criterionAnswersWithEvidence: claims.filter(claim => claim.support !== 'unknown').length,
      unknownCriterionAnswers: claims.filter(claim => claim.support === 'unknown').length,
      evidenceRecords: evidence.length,
      pinnedImplementationRecords: evidence.filter(item => item.kind === 'source-inspected').length,
      observedEvidenceRecords: evidence.filter(item => item.kind === 'observed').length,
      publicSourcedClaims: published.length,
      agentCrossCheckedClaims: crossChecked.length,
      sourcedOnlyClaims: sourcedOnly.length,
      productsWithCrossCheckedClaims: new Set(crossChecked.map(claim => claim.productId)).size,
      roadmapScans: roadmaps.length,
      citedRoadmapAnnouncements: roadmaps.reduce((total, review) => total + (review.announced?.length ?? 0), 0),
    },
    reviewMethod: {
      scope: 'A researcher records each finding with first-party evidence. A different agent rereads the cited sources and records a digest-bound review for the claim and, separately, for each typed filter mapping. Any factual or evidence edit invalidates the review until another independent review. The same rules apply to every product, including the publisher\'s own.',
      limits: 'An agent source cross-check is not a hands-on product test or a human approval of each claim. Unknown atomic answers and unresolved contradictions remain open. Public counts include only findings eligible under the publication gate on this date (freshness, public sources, scope and contradictions), not every candidate.',
    },
    sourcedOnlyPublicClaimIds: sourcedOnly,
    unresolvedContradictionClaimIds: contradicted,
    candidateClaimIdsAwaitingReview: awaitingReview,
    roadmapReview: {
      interpretation: 'Each profile records its own dated roadmap search. Cited announcements are not shipped capabilities, and an empty announcement list reports only the locations searched.',
      sourceOfTruth: 'products/<id>.json context.roadmapReview',
    },
    remainingWork: [
      'Run the shared installation, fleet, collaboration, recovery, specification and review scenarios with installed products where access permits.',
      'Resolve the listed source contradictions and keep release-specific, preview and plan restrictions explicit.',
      'Obtain independent reviews for the listed candidate claims and sourced-only public claims.',
      'Recheck findings after relevant releases or corrections; the site build expires findings at their next-check dates but does not itself verify new releases.',
    ],
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = `${JSON.stringify(reviewSummary(), null, 2)}\n`
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8') !== text) throw new Error('notes/review.json is stale; regenerate it')
    console.log('notes/review.json is current')
  } else {
    writeFileSync(output, text)
    console.log(`Wrote ${output}`)
  }
}
