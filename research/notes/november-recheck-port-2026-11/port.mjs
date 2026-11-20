// Applies a re-verified batch of facts to one product profile.
// Every touched claim returns to public-candidate with review: null and gets a change record.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogDir, updateClaim, afterDays } from '../../lib.mjs';

export const RESEARCHER = 'researcher-ade-25';
export const DATE = '2026-11-12';

export function port(productId, { evidence = [], claims = {}, summary, type = 'product-change', reviewDays = 14, roadmap, mutate }) {
  const path = resolve(catalogDir, 'products', `${productId}.json`);
  const profile = JSON.parse(readFileSync(path, 'utf8'));
  for (const item of evidence) {
    if (profile.evidence.some(e => e.id === item.id)) throw new Error(`${productId}: evidence ${item.id} exists`);
    profile.evidence.push({ kind: 'documented', sourceDate: null, retrievedAt: DATE, visibility: 'public', commit: null, path: null, ...item });
  }
  const claimIds = [], before = {}, after = {}, evidenceIds = new Set(evidence.map(e => e.id));
  for (const [criterionId, patch] of Object.entries(claims)) {
    const claim = profile.claims.find(c => c.criterionId === criterionId);
    const snapshot = JSON.parse(JSON.stringify(claim));
    const ids = new Set(claim.evidenceIds);
    for (const s of Object.values(patch.subanswers ?? {})) for (const id of s.evidenceIds ?? []) ids.add(id);
    const days = patch.reviewDays ?? reviewDays; delete patch.reviewDays;
    updateClaim(profile, criterionId, { ...patch, evidenceIds: [...ids], checkedAt: DATE, nextReviewAt: afterDays(DATE, days), researcher: RESEARCHER });
    claim.review = null;
    if (claim.publication === 'public-reviewed') claim.publication = 'public-candidate';
    const known = Object.values(claim.subanswers).filter(s => s.support !== 'unknown');
    if (claim.support === 'unknown' && known.length && !('support' in patch)) {
      claim.support = 'partial';
      claim.answer = known.map(s => s.answer).join(' ');
      claim.publication = 'public-candidate';
      if (!claim.limitations?.length) claim.limitations = ['Only the atoms cited here are established from documentation; the remaining atoms stay unknown and no hands-on test was run.'];
    }
    claimIds.push(claim.id);
    const b = {}, a = {};
    for (const key of ['answer', 'support', 'contradictions', 'limitations']) if (JSON.stringify(snapshot[key]) !== JSON.stringify(claim[key])) { b[key] = snapshot[key]; a[key] = claim[key]; }
    for (const key of Object.keys(patch.subanswers ?? {})) { b[`subanswers.${key}`] = snapshot.subanswers[key]; a[`subanswers.${key}`] = claim.subanswers[key]; }
    if (snapshot.scope.version !== claim.scope.version) { b['scope.version'] = snapshot.scope.version; a['scope.version'] = claim.scope.version; }
    b[criterionId] = { publication: snapshot.publication, review: snapshot.review ? 'present' : null };
    before[criterionId] = b; after[criterionId] = { ...a, publication: claim.publication, review: null };
  }
  if (roadmap) {
    profile.context.roadmapReview = { ...profile.context.roadmapReview, checkedAt: DATE,
      locations: [...(roadmap.locations ?? []), ...profile.context.roadmapReview.locations],
      announced: [...(roadmap.announced ?? []), ...profile.context.roadmapReview.announced],
      gaps: [...(roadmap.gaps ?? []), ...profile.context.roadmapReview.gaps] };
  }
  mutate?.(profile);
  profile.changes.push({ date: DATE, author: RESEARCHER, type, summary, claimIds, before, after, evidenceIds: [...evidenceIds] });
  writeFileSync(path, `${JSON.stringify(profile, null, 2)}\n`);
  return claimIds;
}
