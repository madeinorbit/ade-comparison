// Reviewer correction to the ADE-25 port (reviewer-ade-25, 2026-11-12).
// port.mjs set checkedAt to 2026-11-12 on every touched claim, although only the patched
// atomic answers were re-read. Following author.mjs applyPass, a claim that already had
// findings keeps its earlier check date, and its next review date is the earlier of the two.
// Each touched claim returns to public-candidate with review: null. Kept for provenance; do not rerun.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { catalogDir } from '../../lib.mjs'

const WHO = 'reviewer-ade-25', DATE = '2026-11-12', BASE = 'ffc6a82'
const products = ['capy', 'github-copilot', 'amp', 'antigravity', 'factory', 'superset', 'kiro', 'zed-delta', 'conductor', 'opencode', 'omnara', 'claude-code', 'verdent']
for (const id of products) {
  const path = resolve(catalogDir, 'products', `${id}.json`)
  const p = JSON.parse(readFileSync(path, 'utf8'))
  const old = JSON.parse(execFileSync('git', ['show', `${BASE}:research/products/${id}.json`], { maxBuffer: 1e8 }))
  const ported = new Set(p.changes.filter(c => c.author === 'researcher-ade-25').flatMap(c => c.claimIds))
  const claimIds = [], before = {}, after = {}
  for (const c of p.claims.filter(c => ported.has(c.id))) {
    const o = old.claims.find(x => x.id === c.id)
    if (o.support === 'unknown' || o.checkedAt === c.checkedAt) continue
    const next = o.nextReviewAt < c.nextReviewAt ? o.nextReviewAt : c.nextReviewAt
    before[c.criterionId] = { checkedAt: c.checkedAt, nextReviewAt: c.nextReviewAt }
    c.checkedAt = o.checkedAt; c.nextReviewAt = next
    after[c.criterionId] = { checkedAt: c.checkedAt, nextReviewAt: c.nextReviewAt }
    c.researcher = WHO; c.review = null; c.publication = 'public-candidate'
    claimIds.push(c.id)
  }
  if (!claimIds.length) continue
  p.changes.push({ date: DATE, author: WHO, type: 'research-correction',
    summary: 'Independent review of the ADE-25 port: the port re-read only the patched atomic answers but moved each whole claim’s check date to 2026-11-12. The earlier check date is restored, and the next review date is the earlier of the two.',
    claimIds, before, after, evidenceIds: [] })
  writeFileSync(path, `${JSON.stringify(p, null, 2)}\n`)
  console.log(id, claimIds.map(x => x.split(':')[1]).join(' '))
}
