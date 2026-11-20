// Reviewer corrections to the ADE-25 port (reviewer-ade-25, 2026-11-12).
// Each corrected claim returns to public-candidate with review: null and researcher
// reviewer-ade-25, so a third agent must review it. Kept for provenance; do not rerun.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { catalogDir } from '../../lib.mjs'

const WHO = 'reviewer-ade-25', DATE = '2026-11-12'
const load = id => JSON.parse(readFileSync(resolve(catalogDir, 'products', `${id}.json`), 'utf8'))
const save = (id, p) => writeFileSync(resolve(catalogDir, 'products', `${id}.json`), `${JSON.stringify(p, null, 2)}\n`)

// Rewrites a templated "did not establish a, b, c." list to the atoms that are still unknown.
function staleList(claim) {
  const unknown = Object.entries(claim.subanswers).filter(([, a]) => a.support === 'unknown').map(([k]) => k)
  return claim.limitations.map(text => text.replace(
    /(first-party sources in this pass did not establish |Unknown after the targeted first-party documentation, release and repository pass: )([a-z_]+(?:, [a-z_]+)*)\./,
    (all, lead, list) => {
      const keep = list.split(', ').filter(k => unknown.includes(k) || !(k in claim.subanswers))
      return keep.length ? `${lead}${keep.join(', ')}.` : 'All atoms named in this criterion are answered or recorded above.'
    }))
}

function correct(productId, fixes, summary, newEvidence = []) {
  const p = load(productId)
  for (const e of newEvidence) {
    if (p.evidence.some(x => x.id === e.id)) throw new Error(`${productId}: ${e.id} exists`)
    p.evidence.push({ kind: 'documented', sourceDate: null, retrievedAt: DATE, visibility: 'public', commit: null, path: null, ...e })
  }
  const claimIds = [], before = {}, after = {}, evidenceIds = new Set(newEvidence.map(e => e.id))
  for (const [criterionId, fix] of Object.entries(fixes)) {
    const c = p.claims.find(x => x.criterionId === criterionId)
    const snap = JSON.parse(JSON.stringify(c))
    if (fix.answer) c.answer = fix.answer
    if (fix.scope) Object.assign(c.scope, fix.scope)
    for (const [k, v] of Object.entries(fix.subanswers ?? {})) {
      const a = c.subanswers[k]
      if (!a) throw new Error(`${productId} ${criterionId}.${k}`)
      if (v.answer) a.answer = v.answer
      if (v.addEvidence) { for (const id of v.addEvidence) { if (!p.evidence.some(e => e.id === id)) throw new Error(`missing ${id}`); evidenceIds.add(id) } a.evidenceIds = [...new Set([...a.evidenceIds, ...v.addEvidence])] }
    }
    c.evidenceIds = [...new Set([...c.evidenceIds, ...Object.values(c.subanswers).flatMap(a => a.evidenceIds)])]
    if (fix.limitations) c.limitations = fix.limitations
    if (fix.staleList) c.limitations = staleList(c)
    if (JSON.stringify(snap) === JSON.stringify(c)) throw new Error(`${productId} ${criterionId}: no change`)
    c.researcher = WHO; c.review = null; c.publication = 'public-candidate'
    claimIds.push(c.id)
    const b = {}, a = {}
    for (const key of ['answer', 'limitations', 'scope']) if (JSON.stringify(snap[key]) !== JSON.stringify(c[key])) { b[key] = snap[key]; a[key] = c[key] }
    for (const k of Object.keys(c.subanswers)) if (JSON.stringify(snap.subanswers[k]) !== JSON.stringify(c.subanswers[k])) { b[`subanswers.${k}`] = snap.subanswers[k]; a[`subanswers.${k}`] = c.subanswers[k] }
    before[criterionId] = b; after[criterionId] = a
  }
  p.changes.push({ date: DATE, author: WHO, type: 'research-correction', summary, claimIds, before, after, evidenceIds: [...evidenceIds] })
  save(productId, p)
  console.log(productId, claimIds.join(' '))
}

const RECITE = 'Independent review of the ADE-25 port: atom citations restored where the port kept earlier facts but dropped the sources for them'

correct('capy', {
  'ACC-01': { subanswers: { desktop_os: { addEvidence: ['nov06-desktop'] } } },
  'ACC-02': { subanswers: { model_providers: { addEvidence: ['nov06-models-and-pricing'] } } },
  'PLAN-05': { subanswers: { multimodal_inputs: { addEvidence: ['nov06-threads', 'nov06-integrations-slack'] } } },
  'PLAN-06': { subanswers: { project_epic_views: { addEvidence: ['nov06-cl070'] } } },
  'RUN-03': { subanswers: { multi_day_continuity: { addEvidence: ['nov06-desktop'] } } },
  'TEAM-02': { subanswers: { plan_scope: { addEvidence: ['nov06-admin-members'],
    answer: 'Roles appear on every plan. Pricing lists the audit log on every plan and SSO / SAML only under Enterprise; the 0.8.0 note sells Google Workspace sign-in as an add-on.' } } },
  'TEAM-05': { subanswers: { comments: { addEvidence: ['nov06-pull-requests'] } } },
  'SHIP-06': { subanswers: { dependency_queues: { addEvidence: ['nov06-pull-requests'] } } },
  'OWN-06': { subanswers: { release_stage: { addEvidence: ['nov06-cl070'] }, release_activity: { addEvidence: ['nov06-changelog'] } } },
}, `${RECITE}. TEAM-02 plan_scope corrected: capy.ai/pricing (2026-11-12) lists the audit log on Lite, Pro, Max and Enterprise, not only Enterprise.`)

const STALE = 'Independent review of the ADE-25 port: limitations still listed atoms the port had just answered, so they contradicted the atomic answers; lists now name only atoms that remain unknown'
correct('github-copilot', {
  'OWN-03': { staleList: true }, 'OWN-04': { staleList: true }, 'OWN-06': { staleList: true }, 'OWN-08': { staleList: true },
  'OWN-09': { staleList: true }, 'RUN-03': { staleList: true }, 'RUN-07': { staleList: true },
  'RUN-01': { staleList: true, subanswers: { managed_cloud: { addEvidence: ['nov07-cloud'] }, payer: { addEvidence: ['gap07-custom-environment'] } } },
}, `${STALE}. RUN-01 managed_cloud and payer citations restored for the Actions-session and custom-host facts the port kept.`)

correct('amp', {
  'ACC-01': { staleList: true, answer: 'Amp apps run on macOS 26+ (Apple silicon), Windows 10 1809+ or Windows 11, and Linux (Debian 12+, Ubuntu 22.04+, Fedora, Arch; x86-64 or ARM64). iPhone and iPad (iOS 26+) use a TestFlight beta and Android 10+ a direct APK; no store release is documented. Web threads run in Orbs at ampcode.com. The CLI runs locally or in scripts. The Windows app starts threads in Orbs or on runners; its share action sends files or text to Puck. Client parity beyond the documented Windows basics remains unknown. Windows notifications report a thread ready for input, mentions and access requests; access requests can be answered in the notification. The guide describes starting an Orb on iPhone and continuing from Mac or terminal; this was not tested.' },
  'ACC-03': { staleList: true }, 'COORD-05': { staleList: true }, 'TEAM-01': { staleList: true }, 'TEAM-06': { staleList: true },
  'PLAN-03': { scope: { surfaceIds: ['apps'] } }, 'PLAN-07': { scope: { surfaceIds: ['apps'] } },
  'COORD-02': { scope: { surfaceIds: ['apps'] } }, 'RUN-06': { scope: { surfaceIds: ['apps'] } },
  'OWN-06': { scope: { surfaceIds: ['apps', 'cli', 'orbs'] } },
}, `${STALE}. ACC-01 answer no longer says Linux availability is unstated or that mobile release restrictions are unverified. Spaces claims (PLAN-03, PLAN-07, COORD-02, RUN-06) and OWN-06 had no surface scope; Spaces is scoped to the Amp apps.`)

correct('antigravity', {
  'RUN-01': { answer: 'Local execution, browser Remote Control of user hosts, and Google-managed Remote Agents, whose rollout to Google AI Ultra and paid Google AI Pro subscribers finished in App 2.30.0 (Nov 9, 2026). The separately billed Gemini API managed-agent preview remains a distinct route.',
    limitations: ['Remote Agents is limited to Google AI Ultra and paid Google AI Pro subscribers; other account types were not shown as eligible.', 'Gemini API preview compute terms are distinct from subscription Remote Agents; no resources or region was tested.'] },
  'OWN-06': { answer: 'App 2.30.0 and 2.31.0 (Nov 9, 2026) and CLI 1.5.4 (Nov 10, 2026) are listed, and the table of contents also lists CLI 1.5.5. Remote Agents finished rolling out to Ultra and paid Pro subscribers in App 2.30.0; model retirements are dated November 18.' },
}, 'Independent review of the ADE-25 port: RUN-01 and OWN-06 answers still described the Remote Agents rollout as gradual and named App 2.29.0 / CLI 1.5.1 as current after the port recorded the finished rollout and newer releases.')

correct('factory', { 'OWN-06': { staleList: true } }, STALE)
correct('kiro', { 'RUN-07': { staleList: true }, 'OWN-06': { staleList: true } }, STALE)
correct('omnara', { 'OWN-04': { limitations: ['Not established by this source pass: interval, seat_minimum, trial, overages, taxes.'] } }, `${STALE}; credits is now answered.`)

correct('claude-code', { 'OWN-06': { answer: (() => { const c = load('claude-code').claims.find(x => x.criterionId === 'OWN-06'); return c.answer.replace('Current changelog lists v2.1.319.', 'GitHub releases run to v2.1.322 (Nov 10, 2026, marked Latest).') })() } },
  'Independent review of the ADE-25 port: OWN-06 answer still named v2.1.319 as current after the port recorded v2.1.322.')

correct('superset', {
  'OWN-06': { scope: { version: 'Paradev desktop-v2.0.8 (GitHub releases and changelog source retrieved 2026-11-12)' },
    answer: 'Superset became Paradev on October 26, 2026; the latest stable GitHub release is desktop-v2.0.8 (Nov 10, 2026). Desktop macOS and experimental Linux; mobile Pro+ and managed Cloud Team/Ultra have separate requirements.',
    subanswers: { release_activity: { answer: 'Version 2.0.6 shipped on 2026-11-08 after desktop-v2.0.5 on November 5, followed by desktop-v2.0.7 (Nov 9) and desktop-v2.0.8 (Nov 10, 2026).', addEvidence: ['nov12r-releases', 'releases-nov07'] } } },
}, 'Independent review of the ADE-25 port: OWN-06 still named desktop-v2.0.5 as the latest stable release; GitHub releases show desktop-v2.0.6, v2.0.7 and v2.0.8 (Nov 8–10, 2026).',
  [{ id: 'nov12r-releases', kind: 'vendor-claimed', sourceDate: '2026-11-10', url: 'https://api.github.com/repos/ParadevAI/Paradev/releases', title: 'ParadevAI/Paradev releases', locator: 'Releases desktop-v2.0.6 to desktop-v2.0.8',
     finding: 'Non-prerelease desktop-v2.0.6 published 2026-11-08, desktop-v2.0.7 on 2026-11-09 and desktop-v2.0.8 on 2026-11-10; desktop-canary and cli-v2.0.8 are prereleases.' }])

correct('zed-delta', {
  'ACC-01': { subanswers: { task_actions: { answer: 'Desktop executes shell-backed tasks; the browser works on replicated files. Since the Nov 11, 2026 launch, choosing a Cloud Runner lets you start turns that run commands from Delta on the web.', addEvidence: ['nov12r-cloud-runners-web'] } } },
}, 'Independent review of the ADE-25 port: ACC-01 task_actions said it was not stated whether Cloud Runners provide shell work from the browser; the Cloud Runners doc says they do.',
  [{ id: 'nov12r-cloud-runners-web', url: 'https://delta.dev/docs/agents/cloud-runners.md', title: 'Cloud Runners', locator: 'Introduction',
     finding: 'A Cloud Runner is a Linux sandbox that runs a thread’s agent turns; the agent keeps working while the laptop sleeps, and you can start turns that run commands from Delta on the web.' }])
