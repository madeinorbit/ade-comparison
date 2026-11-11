import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const sourceCatalogDir = fileURLToPath(new URL('.', import.meta.url));
const catalogCandidates = [
  sourceCatalogDir,
  resolve(process.cwd(), 'research'),
];
export const catalogDir = catalogCandidates.find(directory => existsSync(resolve(directory, 'criteria.json'))) ?? sourceCatalogDir;
export const rubric = JSON.parse(readFileSync(resolve(catalogDir, 'criteria.json'), 'utf8'));
export const criteria = rubric.criteria;
export const today = () => new Date().toISOString().slice(0, 10);
export const afterDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export function createUnknownClaim(productId, criterionId, options = {}) {
  const criterion = criteria.find(row => row.id === criterionId);
  if (!criterion) throw new Error(`Unknown criterion ${criterionId}`);
  const date = options.date ?? today();
  const gap = options.unknownReason ?? 'Queued for research; sources and product access have not yet been checked.';
  return {
    id: `${productId}:${criterionId}`, criterionId, answer: gap, support: 'unknown',
    availability: 'unknown', delivery: 'unknown',
    scope: { surfaceIds: [], version: null, plan: null, os: [], executionModes: [], region: null, harness: null },
    subanswers: Object.fromEntries(criterion.subquestions.map(q => [q.id, { support: 'unknown', answer: `${q.question}: ${gap}`, evidenceIds: [] }])),
    limitations: [], unknownReason: gap, evidenceIds: [], checkedAt: date,
    nextReviewAt: afterDays(date, 14), researcher: options.researcher ?? 'unassigned-researcher',
    publication: 'internal-only', review: null, contradictions: [],
  };
}

export function createUnknownProfile(metadata, options = {}) {
  const { id, name } = metadata;
  if (!id || !name) throw new Error('Profile requires id and name');
  const researchTier = metadata.researchTier ?? 'full-profile';
  return {
    schemaVersion: 1, rubricVersion: rubric.rubricVersion, id, name,
    category: metadata.category ?? 'unassigned', researchTier, researchState: 'queued',
    identity: { website: null, repository: null, aliases: [], company: null, ...metadata.identity },
    surfaces: metadata.surfaces ?? [],
    claims: researchTier === 'full-profile' ? criteria.map(c => createUnknownClaim(id, c.id, options)) : [],
    evidence: [], changes: [], context: metadata.context ?? {},
  };
}

// Patch only the atomic questions the cited sources actually establish.
export function updateClaim(profile, criterionId, patch) {
  const claim = profile.claims.find(row => row.criterionId === criterionId);
  if (!claim) throw new Error(`Missing claim ${criterionId}`);
  const factualKeys = ['answer', 'support', 'availability', 'delivery', 'scope', 'subanswers', 'limitations', 'unknownReason', 'evidenceIds', 'contradictions', 'checkedAt', 'nextReviewAt', 'researcher'];
  if (claim.review && factualKeys.some(key => key in patch) && !('review' in patch)) {
    claim.review = null;
    if (claim.publication === 'public-reviewed') claim.publication = 'public-candidate';
  }
  const { subanswers, scope, ...fields } = patch;
  Object.assign(claim, fields);
  if (scope) Object.assign(claim.scope, scope);
  if (subanswers) {
    const allowed = new Set(criteria.find(c => c.id === criterionId).subquestions.map(q => q.id));
    for (const [key, value] of Object.entries(subanswers)) {
      if (!allowed.has(key)) throw new Error(`Undeclared subquestion ${criterionId}.${key}`);
      claim.subanswers[key] = { ...claim.subanswers[key], ...value };
    }
  }
  return claim;
}

export function loadProducts(directory = resolve(catalogDir, 'products')) {
  return readdirSync(directory).filter(name => name.endsWith('.json')).sort()
    .map(name => JSON.parse(readFileSync(resolve(directory, name), 'utf8')));
}

// Sort object keys so reformatting a profile does not invalidate an evidence review.
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function claimReviewHash(profile, claim) {
  const { review, publication, ...finding } = claim;
  const ids = [...new Set([...claim.evidenceIds, ...Object.values(claim.subanswers).flatMap(answer => answer.evidenceIds)])].sort();
  const evidence = ids.map(id => profile.evidence.find(item => item.id === id) ?? null);
  return createHash('sha256').update(JSON.stringify(canonical({ productId: profile.id, finding, evidence }))).digest('hex');
}

export function lifecycleReviewHash(profile) {
  if (!profile.lifecycle) throw new Error('Missing lifecycle');
  const { review, publication, ...finding } = profile.lifecycle;
  const evidence = finding.evidenceIds.map(id => profile.evidence.find(item => item.id === id) ?? null);
  return createHash('sha256').update(JSON.stringify(canonical({ productId: profile.id, finding, evidence }))).digest('hex');
}

export function updateLifecycle(profile, patch) {
  const previous = profile.lifecycle;
  const lifecycle = { ...previous, ...patch };
  profile.lifecycle = lifecycle;
  if (previous?.review && Object.keys(patch).some(key => !['review', 'publication'].includes(key)) && !('review' in patch)) {
    lifecycle.review = null;
    if (lifecycle.publication === 'public-reviewed') lifecycle.publication = 'public-candidate';
  }
  return lifecycle;
}

// Shared by validation and the public exporter. Missing lifecycle is unknown.
export function lifecycleErrors(profile, { publicationDate, allowOverdue = false, allowSourced = false } = {}) {
  const lifecycle = profile.lifecycle;
  if (!lifecycle) return [];
  const errors = [];
  checkShape(lifecycle, schema.properties.lifecycle, 'lifecycle', errors);
  if (errors.length) return errors;
  const fail = message => errors.push(`lifecycle ${message}`);
  const evidence = lifecycle.evidenceIds.map(id => profile.evidence.find(item => item.id === id));
  if (evidence.some(item => !item)) fail('references missing evidence');
  for (const item of evidence.filter(Boolean)) {
    checkShape(item, schema.properties.evidence.items, `lifecycle evidence ${item.id}`, errors);
    if (item.visibility === 'public') {
      try {
        const url = new URL(item.url);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) fail('needs a public source URL without credentials');
      } catch { fail('needs a public source URL'); }
    }
  }
  if (lifecycle.status !== 'unknown' && (!evidence.length || evidence.every(item => item?.kind === 'unresolved'))) fail('requires resolved cited evidence');
  if (lifecycle.nextReviewAt < lifecycle.checkedAt) fail('next review precedes check date');
  if (lifecycle.announcementDate && lifecycle.announcementDate > lifecycle.checkedAt) fail('announcement follows check date');
  if (lifecycle.review) {
    if (lifecycle.review.reviewer === lifecycle.researcher) fail('reviewer must be independent of researcher');
    if (lifecycle.review.date < lifecycle.checkedAt) fail('review predates research check');
    if (lifecycle.review.contentHash !== lifecycleReviewHash(profile)) fail('review content hash differs; obtain a new independent review');
  }
  if (lifecycle.publication === 'public-reviewed' || allowSourced && lifecycle.publication === 'public-candidate') {
    if (lifecycle.publication === 'public-reviewed' && !lifecycle.review) fail('public-reviewed requires reviewer and date');
    if (lifecycle.status === 'unknown' || lifecycle.contradictions.length) fail('unresolved finding cannot be public-reviewed');
    if (!evidence.length || evidence.some(item => item?.visibility !== 'public' || item?.kind === 'unresolved' || !/^https?:\/\//.test(item?.url ?? ''))) fail('public-reviewed requires public resolved evidence only');
    if (!evidence.some(item => item?.retrievedAt >= lifecycle.checkedAt)) fail('check date needs a cited source recheck');
    if (publicationDate) {
      if (!allowOverdue && lifecycle.nextReviewAt < publicationDate) fail('public finding is due for review');
      if (lifecycle.checkedAt > publicationDate || lifecycle.review?.date > publicationDate || evidence.some(item => item?.retrievedAt > publicationDate || item?.sourceDate > publicationDate)) fail('public finding is dated after publication');
    }
  }
  return errors;
}

export const schema = JSON.parse(readFileSync(resolve(catalogDir, 'schema.json'), 'utf8'));

// This small validator implements the keywords used in schema.json only.
function checkShape(value, rule, path, errors) {
  const fail = message => errors.push(`${path}: ${message}`);
  if (rule.anyOf) {
    if (!rule.anyOf.some(branch => { const issues = []; checkShape(value, branch, path, issues); return issues.length === 0; })) fail('does not match an allowed shape');
    return;
  }
  if ('const' in rule && value !== rule.const) fail(`must equal ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.includes(value)) fail(`must be one of ${rule.enum.join(', ')}`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (rule.type && ![rule.type].flat().includes(type)) { fail(`expected ${[rule.type].flat().join(' or ')}`); return; }
  if (typeof value === 'string') {
    if (rule.minLength && value.trim().length < rule.minLength) fail('must not be blank');
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail('invalid format');
    if (rule.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) fail('expected calendar date YYYY-MM-DD');
  }
  if (Array.isArray(value) && rule.items) value.forEach((item, i) => checkShape(item, rule.items, `${path}[${i}]`, errors));
  if (value && type === 'object') {
    for (const field of rule.required ?? []) if (!(field in value)) fail(`missing ${field}`);
    for (const [field, item] of Object.entries(value)) {
      if (rule.properties?.[field]) checkShape(item, rule.properties[field], `${path}.${field}`, errors);
      else if (rule.additionalProperties === false) fail(`undeclared field ${field}`);
      else if (rule.additionalProperties && typeof rule.additionalProperties === 'object') checkShape(item, rule.additionalProperties, `${path}.${field}`, errors);
    }
  }
}

export function validateProfile(profile, options = {}) {
  const errors = [];
  checkShape(profile, schema, profile?.id ?? 'profile', errors);
  if (errors.length) return errors;
  const fail = message => errors.push(`${profile.id}: ${message}`);
  lifecycleErrors(profile, options).forEach(fail);
  const unique = (rows, field, label) => {
    const seen = new Set();
    for (const row of rows) { if (seen.has(row[field])) fail(`duplicate ${label} ${row[field]}`); seen.add(row[field]); }
    return seen;
  };
  const evidenceIds = unique(profile.evidence, 'id', 'evidence');
  const claimIds = unique(profile.claims, 'id', 'claim');
  const criterionIds = unique(profile.claims, 'criterionId', 'criterion');
  const surfaceIds = unique(profile.surfaces, 'id', 'surface');
  const evidenceById = new Map(profile.evidence.map(e => [e.id, e]));
  const allIds = new Set(criteria.map(c => c.id));
  if (profile.researchTier === 'full-profile') {
    for (const id of allIds) if (!criterionIds.has(id)) fail(`missing criterion ${id}`);
  }
  for (const e of profile.evidence) {
    if (!e.url) fail(`evidence ${e.id} needs a source URL or internal-file path`);
    if (e.url?.startsWith('internal-file:') && e.visibility !== 'internal') fail(`internal source ${e.id} cannot have public visibility`);
    if (e.url?.startsWith('http')) {
      try { const parsed = new URL(e.url); if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) fail(`invalid source URL ${e.id}`); }
      catch { fail(`invalid source URL ${e.id}`); }
    }
    if (e.kind === 'source-inspected' && (!e.commit || !e.path)) fail(`source-inspected evidence ${e.id} needs commit and path`);
    if (e.kind === 'observed') for (const key of ['method', 'configuration', 'fixture', 'result']) if (!e[key]) fail(`observed evidence ${e.id} needs ${key}`);
  }
  const references = (ids, label) => { for (const id of ids) if (!evidenceIds.has(id)) fail(`${label} references missing evidence ${id}`); };
  const roadmap = profile.context.roadmapReview;
  if (profile.researchTier === 'full-profile' && ['documented', 'reviewed'].includes(profile.researchState) && !roadmap) {
    fail('documented full profile needs a roadmap review');
  }
  if (roadmap) {
    if (!roadmap.locations.length && !roadmap.gaps.length) fail('roadmap review needs searched locations or an access gap');
    for (const location of roadmap.locations) {
      if (location.url && !/^https?:\/\/[^\s]+$/.test(location.url)) fail('roadmap location needs a public URL');
    }
    for (const announcement of roadmap.announced) {
      if (!allIds.has(announcement.criterionId)) fail(`roadmap references unknown criterion ${announcement.criterionId}`);
      if (!announcement.evidenceIds.length) fail(`roadmap ${announcement.criterionId} needs cited evidence`);
      references(announcement.evidenceIds, `roadmap ${announcement.criterionId}`);
    }
  }
  for (const claim of profile.claims) {
    const label = claim.criterionId;
    const criterion = criteria.find(c => c.id === label);
    if (!criterion) { fail(`unknown criterion ${label}`); continue; }
    if (claim.id !== `${profile.id}:${label}`) fail(`${label} has unstable claim ID`);
    for (const id of claim.scope.surfaceIds) if (!surfaceIds.has(id)) fail(`${label} references missing surface ${id}`);
    const required = new Set(criterion.subquestions.map(q => q.id));
    for (const key of required) if (!claim.subanswers[key]) fail(`${label} missing atomic question ${key}`);
    for (const [key, atom] of Object.entries(claim.subanswers)) {
      if (!required.has(key)) fail(`${label} undeclared atomic question ${key}`);
      references(atom.evidenceIds, `${label}.${key}`);
      if (['supported', 'partial', 'unsupported'].includes(atom.support) && !atom.evidenceIds.length) fail(`${label}.${key} ${atom.support} requires evidence`);
      if (['supported', 'partial', 'unsupported'].includes(atom.support) && atom.evidenceIds.every(id => evidenceById.get(id)?.kind === 'unresolved')) fail(`${label}.${key} cannot rely only on unresolved evidence`);
    }
    references(claim.evidenceIds, label);
    if (['supported', 'partial', 'unsupported'].includes(claim.support) && !claim.evidenceIds.length) fail(`${label} ${claim.support} requires evidence`);
    if (['supported', 'partial', 'unsupported'].includes(claim.support) && claim.evidenceIds.every(id => evidenceById.get(id)?.kind === 'unresolved')) fail(`${label} cannot rely only on unresolved evidence`);
    if (claim.support === 'unknown' && !claim.unknownReason?.trim()) fail(`${label} unknown requires an explicit gap`);
    if (claim.support === 'partial' && !claim.limitations.length) fail(`${label} partial requires named limitations`);
    if (claim.support === 'not-applicable' && !claim.review) fail(`${label} not-applicable needs reviewer acceptance`);
    if (claim.nextReviewAt < claim.checkedAt) fail(`${label} next review precedes check date`);
    if (claim.review && claim.review.reviewer === claim.researcher) fail(`${label} reviewer must be independent of researcher`);
    if (claim.review && claim.review.date < claim.checkedAt) fail(`${label} review predates research check`);
    if (claim.review && claim.review.contentHash !== claimReviewHash(profile, claim)) fail(`${label} review content hash differs; obtain a new independent review`);
    if (claim.publication === 'public-reviewed') {
      if (!claim.review) fail(`${label} public-reviewed requires reviewer and date`);
      if (claim.support === 'unknown' || claim.contradictions.length) fail(`${label} unresolved claim cannot be public-reviewed`);
      const allEvidence = [...claim.evidenceIds, ...Object.values(claim.subanswers).flatMap(a => a.evidenceIds)];
      if (!claim.evidenceIds.length || allEvidence.some(id => evidenceById.get(id)?.visibility !== 'public' || evidenceById.get(id)?.kind === 'unresolved')) fail(`${label} public-reviewed requires public resolved evidence only`);
      if (!claim.scope.surfaceIds.length) fail(`${label} public-reviewed requires a named product surface`);
      if (options.publicationDate && claim.nextReviewAt < options.publicationDate) fail(`${label} public claim is due for review`);
    }
  }
  for (const change of profile.changes) {
    for (const id of change.claimIds) if (!claimIds.has(id)) fail(`change references missing claim ${id}`);
    references(change.evidenceIds ?? [], 'change');
    if (change.type !== 'initial-research' && (!('before' in change) || !('after' in change))) fail('subsequent change needs before and after values');
  }
  return errors;
}

export function validateRubric(frameworkText) {
  const errors = [];
  const matches = [...frameworkText.matchAll(/^\| ((?:ACC|PLAN|COORD|RUN|TEAM|SHIP|OWN)-\d\d) \| (.*?) \| (.*?) \|$/gm)];
  const records = new Map(matches.map(([, id, title, judgment]) => [id, { title, judgment }]));
  if (records.size !== 51 || criteria.length !== 51) errors.push('Framework and criteria must have exactly 51 rows');
  if (!frameworkText.includes(`v${rubric.rubricVersion}`)) errors.push('Framework rubric version differs');
  for (const criterion of criteria) {
    const doc = records.get(criterion.id);
    if (!doc || doc.title !== criterion.title || doc.judgment !== criterion.judgment) errors.push(`Rubric divergence: ${criterion.id}`);
    if (!criterion.subquestions.length || new Set(criterion.subquestions.map(q => q.id)).size !== criterion.subquestions.length) errors.push(`Invalid atomic questions: ${criterion.id}`);
  }
  return errors;
}
