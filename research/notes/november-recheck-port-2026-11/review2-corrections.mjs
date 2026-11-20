// Second independent review of the ADE-25 port (reviewer2-ade-25, 2026-11-12).
// The corrected claim returns to public-candidate with review: null and researcher
// reviewer2-ade-25, so another agent must review it. Kept for provenance; do not rerun.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { catalogDir } from '../../lib.mjs'

const WHO = 'reviewer2-ade-25', DATE = '2026-11-12'
const path = resolve(catalogDir, 'products', 'antigravity.json')
const p = JSON.parse(readFileSync(path, 'utf8'))
const evidence = {
  id: 'nov12r2-cl-cli-1-5-5', kind: 'documented', url: 'https://antigravity.google/docs/changelog',
  title: 'Antigravity changelog', locator: 'Antigravity CLI v1.5.5 (November 10, 2026)', sourceDate: '2026-11-10',
  retrievedAt: DATE, visibility: 'public', commit: null, path: null,
  finding: 'CLI v1.5.5, dated November 10, 2026 and labelled Latest, has its own entry: an agent swarms preview with /swarm and /swarm board, Gemini 4 Carbon models with Application Default Credentials, HTTPS for remote enterprise model gateways, and plugin import, subagent worktree and headless shutdown fixes.',
}
if (p.evidence.some(e => e.id === evidence.id)) throw new Error(`${evidence.id} exists`)
p.evidence.push(evidence)

const c = p.claims.find(x => x.criterionId === 'OWN-06')
const before = { answer: c.answer, scope: { ...c.scope }, 'subanswers.release_activity': { ...c.subanswers.release_activity } }
c.answer = 'App 2.30.0 and 2.31.0 (Nov 9, 2026) and CLI 1.5.4 and 1.5.5 (Nov 10, 2026) are listed; CLI 1.5.5 is labelled Latest. Remote Agents finished rolling out to Ultra and paid Pro subscribers in App 2.30.0; model retirements are dated November 18.'
c.scope.version = 'Antigravity App 2.31.0 / CLI 1.5.5 (changelog retrieved 2026-11-12)'
const ra = c.subanswers.release_activity
ra.answer = 'App 2.30.0 and 2.31.0 on November 9, 2026; CLI 1.5.0 on November 4, and 1.5.4 and 1.5.5 on November 10, 2026.'
ra.evidenceIds = [...new Set([...ra.evidenceIds, evidence.id])]
c.evidenceIds = [...new Set([...c.evidenceIds, evidence.id])]
c.researcher = WHO; c.review = null; c.publication = 'public-candidate'
p.changes.push({ date: DATE, author: WHO, type: 'research-correction',
  summary: 'Second independent review of the ADE-25 port: the changelog has a full CLI 1.5.5 entry dated November 10, 2026 and labelled Latest, but OWN-06 said only that the table of contents lists it and named CLI 1.5.4 as the newest release.',
  claimIds: [c.id], before: { 'OWN-06': before },
  after: { 'OWN-06': { answer: c.answer, scope: { ...c.scope }, 'subanswers.release_activity': { ...ra } } },
  evidenceIds: [evidence.id] })
writeFileSync(path, `${JSON.stringify(p, null, 2)}\n`)
console.log('antigravity OWN-06 corrected')
