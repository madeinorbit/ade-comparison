import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimReviewHash, createUnknownProfile, criteria, updateClaim, validateProfile, validateRubric } from './lib.mjs';

function fixture() {
  return createUnknownProfile({ id: 'fixture', name: 'Fixture', category: 'A', surfaces: [{ id: 'web', name: 'Web', type: 'web' }] }, { date: '2026-09-16', researcher: 'researcher' });
}
function sourced() {
  const p = fixture();
  p.evidence.push({ id: 'official-docs', kind: 'documented', url: 'https://example.com/docs', title: 'Official docs', locator: 'Browser access', sourceDate: null, retrievedAt: '2026-09-16', finding: 'The product documents browser access.', visibility: 'public', commit: null, path: null });
  updateClaim(p, 'ACC-01', { answer: 'Browser access is documented. Other clients are unverified.', support: 'partial', limitations: ['Other clients have not been verified.'], availability: 'generally-available', delivery: 'native', evidenceIds: ['official-docs'], scope: { surfaceIds: ['web'], plan: 'All documented plans' }, subanswers: { browser: { support: 'supported', answer: 'Browser access is documented.', evidenceIds: ['official-docs'] } } });
  return p;
}

test('all 51 criteria and their frozen atoms match the approved framework', () => {
  const text = readFileSync(new URL('./comparison-framework.md', import.meta.url), 'utf8');
  assert.equal(criteria.length, 51);
  assert.deepEqual(validateRubric(text), []);
  assert.match(validateRubric(text.replace('Client access', 'Changed meaning')).join('\n'), /Rubric divergence/);
});

test('unknown full profile and empty qualification lead both validate without fabricated evidence', () => {
  assert.deepEqual(validateProfile(fixture()), []);
  const lead = createUnknownProfile({ id: 'lead', name: 'Lead', researchTier: 'qualification' });
  assert.equal(lead.claims.length, 0);
  assert.deepEqual(validateProfile(lead), []);
});

test('missing coverage and undeclared or missing atomic questions are rejected', () => {
  const p = fixture(); p.claims.pop();
  delete p.claims[0].subanswers.desktop_os;
  p.claims[0].subanswers.magic = { support: 'unknown', answer: 'Not researched.', evidenceIds: [] };
  const errors = validateProfile(p).join('\n');
  assert.match(errors, /missing criterion OWN-09/);
  assert.match(errors, /missing atomic question desktop_os/);
  assert.match(errors, /undeclared atomic question magic/);
});

test('source references and evidence for negative assertions are required', () => {
  const p = fixture();
  p.claims[0].support = 'unsupported';
  p.claims[0].subanswers.browser = { support: 'unsupported', answer: 'No browser access.', evidenceIds: ['missing'] };
  const errors = validateProfile(p).join('\n');
  assert.match(errors, /unsupported requires evidence/);
  assert.match(errors, /references missing evidence missing/);
});

test('public review requires an independent reviewer and publicly checkable evidence', () => {
  const p = sourced(); p.claims[0].publication = 'public-reviewed';
  assert.match(validateProfile(p).join('\n'), /requires reviewer/);
  p.claims[0].review = { reviewer: 'researcher', date: '2026-09-16', contentHash: claimReviewHash(p, p.claims[0]) };
  assert.match(validateProfile(p).join('\n'), /independent/);
  p.claims[0].review.reviewer = 'reviewer';
  assert.deepEqual(validateProfile(p), []);
  p.evidence[0].visibility = 'internal';
  assert.match(validateProfile(p).join('\n'), /public resolved evidence only/);
});

test('public claims fail for unresolved contradictions or expired verification', () => {
  const p = sourced(); Object.assign(p.claims[0], { publication: 'public-reviewed', review: { reviewer: 'reviewer', date: '2026-09-16', contentHash: claimReviewHash(p, p.claims[0]) }, contradictions: ['Conflicting docs need investigation.'] });
  assert.match(validateProfile(p).join('\n'), /unresolved claim/);
  p.claims[0].contradictions = [];
  assert.match(validateProfile(p, { publicationDate: '2026-10-30' }).join('\n'), /due for review/);
});

test('code inspection requires a revision and path; tests require reproducible configuration', () => {
  const p = sourced(); p.evidence[0].kind = 'source-inspected';
  assert.match(validateProfile(p).join('\n'), /needs commit and path/);
  Object.assign(p.evidence[0], { commit: 'a'.repeat(40), path: 'src/client.ts' });
  assert.deepEqual(validateProfile(p), []);
  p.evidence[0].kind = 'observed';
  assert.match(validateProfile(p).join('\n'), /needs configuration/);
});

test('internal paths are explicit and never eligible as public sources', () => {
  const p = sourced(); p.evidence[0].url = 'internal-file:apps/web/client.ts';
  assert.match(validateProfile(p).join('\n'), /cannot have public visibility/);
  p.evidence[0].visibility = 'internal';
  assert.deepEqual(validateProfile(p), []);
  p.evidence[0].url = '/tmp/notes.txt';
  assert.match(validateProfile(p).join('\n'), /allowed shape/);
});

test('updates preserve unsourced atomic unknowns and reject invented keys', () => {
  const p = sourced();
  assert.equal(p.claims[0].subanswers.mobile_apps.support, 'unknown');
  assert.throws(() => updateClaim(p, 'ACC-01', { subanswers: { imaginary: { support: 'supported' } } }), /Undeclared/);
});

test('change records preserve before and after, dates and stable references', () => {
  const p = sourced();
  p.changes.push({ date: '2026-09-16', author: 'researcher', type: 'research-correction', summary: 'Corrected access scope.', claimIds: ['fixture:ACC-01'] });
  assert.match(validateProfile(p).join('\n'), /before and after/);
  Object.assign(p.changes[0], { before: 'Unverified', after: 'Browser access documented' });
  assert.deepEqual(validateProfile(p), []);
  p.claims[0].checkedAt = '2026-02-30';
  assert.match(validateProfile(p).join('\n'), /calendar date/);
});

test('roadmap review records searched locations and cited announcements', () => {
  const p = sourced();
  p.researchState = 'documented';
  assert.match(validateProfile(p).join('\n'), /documented full profile needs a roadmap review/);
  p.context.roadmapReview = {
    checkedAt: '2026-09-23',
    locations: [{ url: 'https://example.com/roadmap', result: 'Announced browser access for a future release.' }],
    announced: [{ criterionId: 'ACC-01', summary: 'Browser access announced.', sourceDate: null, targetDate: null, evidenceIds: ['official-docs'] }],
    gaps: [],
  };
  assert.deepEqual(validateProfile(p), []);
  p.context.roadmapReview.announced[0].evidenceIds = ['missing'];
  assert.match(validateProfile(p).join('\n'), /roadmap ACC-01 references missing evidence missing/);
  p.context.roadmapReview.announced = [];
  p.context.roadmapReview.locations = [];
  assert.match(validateProfile(p).join('\n'), /roadmap review needs searched locations or an access gap/);
});

test('editing a reviewed fact requires a fresh independent review', () => {
  const p = sourced();
  const c = p.claims.find(c => c.criterionId === 'ACC-01');
  c.publication = 'public-reviewed'; c.review = { reviewer: 'independent-reviewer', date: '2026-09-16', contentHash: claimReviewHash(p, c) };
  updateClaim(p, 'ACC-01', { answer: 'Browser access is documented only for the paid plan.' });
  assert.equal(c.review, null);
  assert.equal(c.publication, 'public-candidate');
});

test('claim reviews require a digest of the claim and all cited evidence', () => {
  const p = sourced(), claim = p.claims[0];
  claim.publication = 'public-reviewed';
  claim.review = { reviewer: 'independent-reviewer', date: '2026-09-16', contentHash: claimReviewHash(p, claim) };
  assert.deepEqual(validateProfile(p), []);
  for (const mutate of [
    p => p.claims[0].answer = 'Changed answer.',
    p => p.claims[0].subanswers.browser.answer = 'Changed atomic answer.',
    p => p.claims[0].scope.plan = 'Enterprise only',
    p => p.claims[0].nextReviewAt = '2026-10-01',
    p => p.claims[0].researcher = 'different-researcher',
    p => p.evidence[0].finding = 'Changed source finding.',
    p => p.evidence[0].locator = 'Different section',
    p => p.evidence[0].retrievedAt = '2026-09-17',
    p => p.claims[0].review.contentHash = '0'.repeat(64),
  ]) {
    const changed = structuredClone(p); mutate(changed);
    assert.match(validateProfile(changed).join('\n'), /review content hash differs/);
  }
  delete claim.review.contentHash;
  assert.match(validateProfile(p).join('\n'), /allowed shape/);
});

test('claim digests bind atomic-only citations, and ignore unrelated edits and object ordering', () => {
  const p = sourced(), claim = p.claims[0];
  p.evidence.push({ ...p.evidence[0], id: 'atomic-only', finding: 'Additional browser detail.' });
  claim.subanswers.browser.evidenceIds.push('atomic-only');
  const hash = claimReviewHash(p, claim);
  p.evidence[1].finding = 'Changed atomic source.';
  assert.notEqual(claimReviewHash(p, claim), hash);
  p.evidence[1].finding = 'Additional browser detail.';
  p.evidence.push({ id: 'unrelated', finding: 'Private research note.' });
  p.context.note = 'Unrelated context';
  claim.review = { reviewer: 'reviewer', date: '2026-09-16', contentHash: hash };
  claim.publication = 'public-reviewed';
  claim.scope = Object.fromEntries(Object.entries(claim.scope).reverse());
  assert.equal(claimReviewHash(p, Object.fromEntries(Object.entries(claim).reverse())), hash);
  for (const patch of [{ nextReviewAt: '2026-10-01' }, { researcher: 'another-researcher' }]) {
    const changed = structuredClone(p);
    updateClaim(changed, 'ACC-01', patch);
    assert.equal(changed.claims[0].review, null);
    assert.equal(changed.claims[0].publication, 'public-candidate');
  }
});

test('lifecycle is optional, scoped and independently reviewed with an evidence-bound digest', async () => {
  const { lifecycleReviewHash, updateLifecycle } = await import('./lib.mjs');
  const p = sourced();
  const claims = structuredClone(p.claims);
  p.lifecycle = {
    status: 'sunset', note: 'Hosted service is sunsetting.', scope: 'Hosted service',
    continuation: 'Local open-source workspaces continue.', announcementDate: '2026-09-01', serviceEndDate: null,
    checkedAt: '2026-09-16', nextReviewAt: '2026-09-30', evidenceIds: ['official-docs'],
    researcher: 'researcher', publication: 'public-candidate', review: null, contradictions: [],
  };
  assert.deepEqual(validateProfile(p), []);
  p.lifecycle.publication = 'public-reviewed';
  assert.match(validateProfile(p).join('\n'), /lifecycle public-reviewed requires reviewer/);
  p.lifecycle.review = { reviewer: 'reviewer', date: '2026-09-16', contentHash: lifecycleReviewHash(p) };
  assert.deepEqual(validateProfile(p), []);
  const reviewed = structuredClone(p);
  for (const [mutate, expected] of [
    [p => p.lifecycle.review.reviewer = 'researcher', /independent/],
    [p => p.lifecycle.review.date = '2026-09-15', /predates/],
    [p => p.lifecycle.note = 'Changed wording.', /content hash differs/],
    [p => p.lifecycle.scope = 'Entire product', /content hash differs/],
    [p => p.lifecycle.continuation = null, /content hash differs/],
    [p => p.lifecycle.nextReviewAt = '2026-10-30', /content hash differs/],
    [p => p.evidence[0].finding = 'Changed source.', /content hash differs/],
    [p => p.lifecycle.evidenceIds = ['missing'], /missing evidence/],
    [p => p.evidence[0].visibility = 'internal', /public resolved evidence/],
    [p => p.evidence[0].kind = 'unresolved', /resolved cited evidence/],
    [p => p.lifecycle.contradictions = ['Conflicting source.'], /unresolved finding/],
    [p => p.lifecycle.status = 'unknown', /unresolved finding/],
    [p => p.lifecycle.status = 'active', /must be one of unknown, sunset/],
    [p => p.lifecycle.scope = '', /must not be blank/],
    [p => p.lifecycle.serviceEndDate = '2026-02-30', /allowed shape/],
  ]) {
    const changed = structuredClone(reviewed); mutate(changed);
    assert.match(validateProfile(changed).join('\n'), expected);
  }
  assert.match(validateProfile(p, { publicationDate: '2026-10-01' }).join('\n'), /lifecycle public finding is due/);
  assert.match(validateProfile(p, { publicationDate: '2026-09-15' }).join('\n'), /dated after publication/);
  updateLifecycle(p, { note: 'A revised scoped notice.' });
  assert.equal(p.lifecycle.review, null);
  assert.equal(p.lifecycle.publication, 'public-candidate');
  assert.deepEqual(p.claims, claims, 'lifecycle updates never rewrite feature support');
});

test('lifecycle review digest ignores key ordering and unrelated evidence, but binds check dates', async () => {
  const { lifecycleReviewHash } = await import('./lib.mjs');
  const p = sourced();
  p.lifecycle = { status: 'sunset', evidenceIds: ['official-docs'], checkedAt: '2026-09-16' };
  const hash = lifecycleReviewHash(p);
  p.lifecycle = Object.fromEntries(Object.entries(p.lifecycle).reverse());
  p.evidence.push({ id: 'unrelated', finding: 'Private note.' });
  assert.equal(lifecycleReviewHash(p), hash);
  p.lifecycle.checkedAt = '2026-09-17';
  assert.notEqual(lifecycleReviewHash(p), hash);
});
