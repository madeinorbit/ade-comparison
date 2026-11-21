#!/usr/bin/env node
// Monthly whole-catalog recheck handler.
//
//   node research/catalog-recheck.mjs plan [--month YYYY-MM] [--json]
//   node research/catalog-recheck.mjs run  [--month YYYY-MM] [--dry-run] [--start] [--parent-id REF]
//   node research/catalog-recheck.mjs sync --month YYYY-MM --commit SHA --deploy-run ID [--dry-run]
//
// `plan` only reads the checkout. `run` resumes or files the dated
// "Catalog recheck YYYY-MM" issue in the Podium tracker under the idempotency
// key ade-catalog-recheck:YYYY-MM. `sync` files the podium-cloud snapshot-sync
// task, and only for a commit that is on origin/main with a successful deploy.
// Nothing here edits research files: evidence keeps its recorded dates.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG = JSON.parse(readFileSync(join(REPO_ROOT, 'research', 'catalog-recheck', 'config.json'), 'utf8'));
export const BATCH_SIZE = CONFIG.batchSize;
const MANIFEST_NAME = 'catalog-manifest.json';

export class BlockedError extends Error {
  constructor(message) { super(message); this.name = 'BlockedError'; }
}

export function monthKey(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`month must be YYYY-MM, got ${JSON.stringify(month)}`);
  return `${CONFIG.idempotencyPrefix}:${month}`;
}
export const monthTitle = (month) => `Catalog recheck ${month}`;
export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7);

export function chunk(items, size = BATCH_SIZE) {
  if (!(size >= 1 && size <= 11)) throw new Error('batch size must be between 1 and 11');
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

// Evidence age as recorded; read-only. Overdue claims stay visible with their age.
function evidenceAge(profile, runDate) {
  const checked = (profile.claims || []).map((c) => c.checkedAt).filter(Boolean).sort();
  const overdue = (profile.claims || []).filter((c) => c.nextReviewAt && c.nextReviewAt < runDate).length;
  return { oldestCheckedAt: checked[0] ?? null, newestCheckedAt: checked.at(-1) ?? null, overdueClaims: overdue };
}

export function buildPlan({ root = REPO_ROOT, month, now = new Date(), commit } = {}) {
  monthKey(month);
  const runDate = now.toISOString().slice(0, 10);
  const productDir = join(root, 'research', 'products');
  const profiles = readdirSync(productDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(productDir, f), 'utf8')))
    .map((p) => ({ id: p.id, name: p.name, researchState: p.researchState, ...evidenceAge(p, runDate) }));
  const registry = JSON.parse(readFileSync(join(root, 'research', 'registry.json'), 'utf8'));
  const register = registry.products
    .filter((p) => p.researchTier !== 'full-profile')
    .map((p) => ({ id: p.id, name: p.name, researchTier: p.researchTier, category: p.category }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const profileBatches = chunk(profiles);
  const registerBatches = chunk(register);
  const pad = (n) => String(n).padStart(2, '0');
  const tasks = [
    ...profileBatches.map((items, i) => ({
      key: `profiles-${pad(i + 1)}`,
      title: `Profile batch ${pad(i + 1)} of ${pad(profileBatches.length)}`,
      kind: 'profiles',
      productIds: items.map((p) => p.id),
    })),
    ...registerBatches.map((items, i) => ({
      key: `register-${pad(i + 1)}`,
      title: `Register batch ${pad(i + 1)} of ${pad(registerBatches.length)}`,
      kind: 'register',
      productIds: items.map((p) => p.id),
    })),
  ];
  return {
    key: monthKey(month),
    title: monthTitle(month),
    month,
    runDate,
    upstream: { repository: CONFIG.repository, commit: commit ?? git(root, ['rev-parse', 'HEAD']) },
    counts: { profiles: profiles.length, register: register.length, researchTasks: tasks.length },
    profiles,
    register,
    tasks,
    review: { key: 'review', title: 'Independent recheck review', waitsOn: tasks.map((t) => t.key) },
  };
}

const RULES = `Rules (from the accepted monthly recheck proposal and research/AGENTS.md):
- Work in ${CONFIG.repository}; read AGENTS.md and research/AGENTS.md first. Use your own worktree and branch.
- Each source pass checks current first-party docs, releases/changelog, roadmap and public issues, and inspects pinned public code where it can answer a question. Record retrieval date and scope; keep unknowns and contradictions explicit; leave new or changed facts at public-candidate.
- Check screenshot provenance and that it still shows the primary work view.
- Preserve evidence age. A page build, a working URL or a new month never refreshes a claim. Unchanged evidence keeps its checkedAt and nextReviewAt; never extend or restamp dates automatically, and never expire findings. Past-due findings stay visible with their age.
- Commit one product's inputs and generated outputs together, run npm run verify before any push, and watch the deploy afterwards.
- Any unresolved finding remains a recorded gap.`;

export function taskBrief(plan, task) {
  const scope = task.kind === 'profiles'
    ? `Recheck these full profiles against current first-party sources: ${task.productIds.join(', ')}.`
    : `Check these qualification/watch register entries (research/registry.json) for changed identity, access or maintenance information; record changes as register edits with sources: ${task.productIds.join(', ')}.`;
  return `${plan.key} / ${task.key}. Catalog snapshot ${plan.upstream.commit} enumerated ${plan.runDate}.\n${scope}\nThe "${MANIFEST_NAME}" artifact on the parent issue lists each product's recorded evidence age.\nThe independent review task waits on this task; hand it a list of commits and remaining gaps when done.\n${RULES}`;
}

export function reviewBrief(plan) {
  return `${plan.key} / review. A different agent from every research batch independently checks meaning, atomic citations, screenshot acceptance and typed mappings for every change the ${plan.tasks.length} batches committed, using claimReviewHash from research/lib.mjs. Do not approve human comparison pages.\nAfter the reviewed changes are on origin/main and the deploy run succeeded, file the podium-cloud snapshot sync with:\n  node research/catalog-recheck.mjs sync --month ${plan.month} --commit <upstream sha> --deploy-run <run id>\nDo not edit the vendored snapshot yourself.\n${RULES}`;
}

export function monthBrief(plan) {
  return `Idempotency key: ${plan.key}\nMonthly whole-catalog recheck (user authorized 2026-11-11). Snapshot ${plan.upstream.commit}, ${plan.counts.profiles} full profiles and ${plan.counts.register} register entries, filed as ${plan.tasks.length} batches of at most ${BATCH_SIZE} plus one independent review. Coordinate: claim the coordinator seat, start batches in turn within the daily spawn budget, start the review only when every batch is done, close accepted tasks. Sync Podium only after verified upstream commits (see the review task). Never restamp evidence dates.`;
}

// ---- Tracker -----------------------------------------------------------------

export class PodiumTracker {
  constructor({ repoPath = REPO_ROOT, bin = process.env.ADE_RECHECK_PODIUM_BIN || 'podium', exec = execFileSync } = {}) {
    this.repoPath = repoPath; this.bin = bin; this.exec = exec;
  }
  call(args, { json = true } = {}) {
    let out;
    try {
      out = this.exec(this.bin, ['issue', ...args, ...(json ? ['--json'] : [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      if (err.code === 'ENOENT') throw new BlockedError(`Podium CLI "${this.bin}" is not installed in this environment`);
      throw new Error(`podium issue ${args[0]} failed: ${(err.stderr || err.message).toString().trim()}`);
    }
    if (!json) return out;
    const parsed = JSON.parse(out);
    if (parsed.ok === false) throw new Error(`podium issue ${args[0]} refused: ${parsed.error ?? out}`);
    return parsed.data;
  }
  ping() { this.call(['search', '--repo-path', this.repoPath, '--text', 'ade-catalog-recheck-ping']); }
  findByTitle(title, key) {
    const hits = [];
    for (const status of [null, 'closed']) {
      const args = ['search', '--repo-path', this.repoPath, '--text', title];
      if (status) args.push('--status', status);
      hits.push(...this.call(args));
    }
    const seen = new Set();
    return hits.filter((i) => i.title === title && (i.brief ?? '').includes(key) && !seen.has(i.id) && seen.add(i.id));
  }
  children(ref) { return this.call(['children', ref]); }
  create(fields) {
    const args = ['create', '--repo-path', fields.repoPath ?? this.repoPath, '--title', fields.title, '--description', fields.description, '--brief', fields.brief];
    if (fields.parentId) args.push('--parent-id', fields.parentId);
    return this.call(args);
  }
  depAdd(from, to) { this.call(['dep-add', from, to]); }
  getArtifact(ref, name) {
    const dir = mkdtempSync(join(tmpdir(), 'ade-recheck-'));
    try {
      this.call(['artifact', ref, '--get', name, '--out', join(dir, name)], { json: false });
      return readFileSync(join(dir, name), 'utf8');
    } catch { return null; } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  addArtifact(ref, name, content, title) {
    this.call(['artifact', ref, '--content', content, '--name', name, '--title', title], { json: false });
  }
  start(ref) { this.call(['start', ref], { json: false }); }
}

const refOf = (issue) => issue.displayRef ?? issue.id;

// Resume-or-file. Every step is keyed by title so a retry never duplicates work.
export function runMonth({ plan, tracker, parentId = CONFIG.parentId, start = false, dryRun = false, log = console.log }) {
  const actions = [];
  const act = (desc, fn) => { actions.push(desc); log(`${dryRun ? '[dry-run] ' : ''}${desc}`); return dryRun ? null : fn(); };

  tracker.ping();
  const existing = tracker.findByTitle(plan.title, plan.key);
  if (existing.length > 1) throw new Error(`more than one issue carries ${plan.key}: ${existing.map(refOf).join(', ')}; resolve the duplicate before rerunning`);
  let month = existing[0];
  let resumed = Boolean(month);
  if (month && ['done', 'closed'].includes(month.stage ?? month.status)) {
    log(`${plan.key}: ${refOf(month)} is already closed; nothing to do`);
    return { issue: refOf(month), resumed, closed: true, actions };
  }
  if (!month) {
    month = act(`create issue "${plan.title}"${parentId ? ` under ${parentId}` : ''}`, () => tracker.create({
      title: plan.title, parentId,
      description: `Monthly recheck of every adecomparison.com profile and register entry for ${plan.month}.`,
      brief: monthBrief(plan),
    })) ?? { displayRef: '<new issue>' };
  } else {
    log(`${plan.key}: resuming ${refOf(month)}`);
  }
  const ref = refOf(month);

  // The first run freezes the enumeration; a retry reuses it so batches stay stable.
  let effective = plan;
  const stored = resumed ? tracker.getArtifact(ref, MANIFEST_NAME) : null;
  if (stored) {
    effective = JSON.parse(stored);
    if (effective.key !== plan.key) throw new Error(`${ref} manifest belongs to ${effective.key}`);
    log(`using stored manifest from ${effective.runDate} at ${effective.upstream.commit}`);
  } else {
    act(`attach ${MANIFEST_NAME} (${plan.counts.profiles} profiles, ${plan.counts.register} register entries, commit ${plan.upstream.commit})`,
      () => tracker.addArtifact(ref, MANIFEST_NAME, JSON.stringify(plan, null, 2), `Catalog enumeration ${plan.month}`));
  }

  const have = new Map((resumed ? tracker.children(ref) : []).map((c) => [c.title, c]));
  const filed = {};
  for (const task of effective.tasks) {
    filed[task.key] = have.get(task.title) ?? act(`file task "${task.title}" (${task.productIds.length} products)`, () => tracker.create({
      title: task.title, parentId: ref,
      description: `Recheck ${task.productIds.length} catalog ${task.kind === 'profiles' ? 'profiles' : 'register entries'} for ${effective.month}.`,
      brief: taskBrief(effective, task),
    }));
  }
  let review = have.get(effective.review.title);
  const reviewIsNew = !review;
  review = review ?? act(`file task "${effective.review.title}"`, () => tracker.create({
    title: effective.review.title, parentId: ref,
    description: `Independent review of every change from the ${effective.month} recheck batches.`,
    brief: reviewBrief(effective),
  }));
  const existingDeps = new Set((review?.deps ?? []).map((d) => d.id));
  for (const task of effective.tasks) {
    const t = filed[task.key];
    if (!reviewIsNew && t && existingDeps.has(t.id)) continue;
    act(`review waits on "${task.title}"`, () => tracker.depAdd(refOf(review), refOf(t)));
  }

  if (!dryRun) {
    const titles = new Set(tracker.children(ref).map((c) => c.title));
    const missing = [...effective.tasks.map((t) => t.title), effective.review.title].filter((t) => !titles.has(t));
    if (missing.length) throw new Error(`not starting: ${missing.length} tasks missing on ${ref}: ${missing.join(', ')}`);
  }
  if (start) act(`start coordinator session on ${ref}`, () => tracker.start(ref));
  return { issue: ref, resumed, closed: false, actions, tasks: effective.tasks.length };
}

// Snapshot sync, filed only for a verified upstream commit.
export function syncSnapshot({ month, commit, deployRun, root = REPO_ROOT, tracker, dryRun = false, log = console.log, gh = execFileSync }) {
  monthKey(month);
  if (!/^[0-9a-f]{7,40}$/.test(commit)) throw new Error('commit must be a hex SHA');
  git(root, ['fetch', '--quiet', 'origin', 'main']);
  try { git(root, ['merge-base', '--is-ancestor', commit, 'origin/main']); }
  catch { throw new Error(`${commit} is not on origin/main; not syncing`); }
  const run = JSON.parse(gh('gh', ['run', 'view', String(deployRun), '--repo', CONFIG.repository, '--json', 'conclusion,headSha,workflowName'], { encoding: 'utf8' }));
  if (run.conclusion !== 'success') throw new Error(`deploy run ${deployRun} concluded ${run.conclusion}; not syncing`);
  try { git(root, ['merge-base', '--is-ancestor', commit, run.headSha]); }
  catch { throw new Error(`deploy run ${deployRun} (${run.headSha}) does not contain ${commit}`); }
  const title = `ADE snapshot sync ${month}`;
  const key = `${monthKey(month)}:sync`;
  const syncTracker = new PodiumTracker({ repoPath: CONFIG.syncRepoPath, exec: tracker.exec, bin: tracker.bin });
  const existing = syncTracker.findByTitle(title, key);
  if (existing.length) { log(`${key}: ${refOf(existing[0])} already filed`); return { issue: refOf(existing[0]), created: false }; }
  const brief = `Idempotency key: ${key}\nUpdate the vendored ADE comparison snapshot to ${CONFIG.repository}@${commit} (deploy run ${deployRun} succeeded). Do not edit snapshot content by hand and do not approve human comparison pages automatically.`;
  log(`${dryRun ? '[dry-run] ' : ''}file "${title}" in ${CONFIG.syncRepoPath} for ${commit}`);
  if (dryRun) return { issue: null, created: false };
  const issue = syncTracker.create({ title, description: `Bring the ${month} ADE catalog recheck into podium-cloud.`, brief });
  return { issue: refOf(issue), created: true };
}

// ---- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const name = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (['json', 'dryRun', 'start'].includes(name)) opts[name] = true;
    else opts[name] = rest[++i];
  }
  return opts;
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const month = opts.month ?? currentMonth();
  try {
    if (opts.command === 'plan') {
      const plan = buildPlan({ month });
      if (opts.json) console.log(JSON.stringify(plan, null, 2));
      else {
        console.log(`${plan.key} → "${plan.title}" at ${plan.upstream.commit}`);
        console.log(`${plan.counts.profiles} profiles, ${plan.counts.register} register entries → ${plan.tasks.length} batches (≤${BATCH_SIZE}) + review`);
        for (const t of plan.tasks) console.log(`  ${t.title}: ${t.productIds.join(', ')}`);
        console.log(`  ${plan.review.title}: waits on all ${plan.tasks.length} batches`);
      }
      return 0;
    }
    if (opts.command === 'run') {
      const plan = buildPlan({ month });
      console.log(`${plan.key}: ${plan.counts.profiles} profiles + ${plan.counts.register} register entries at ${plan.upstream.commit} → ${plan.tasks.length} batches + review`);
      const result = runMonth({ plan, tracker: new PodiumTracker({ repoPath: opts.repoPath ?? CONFIG.repoPath }), parentId: opts.parentId ?? CONFIG.parentId, start: Boolean(opts.start), dryRun: Boolean(opts.dryRun) });
      console.log(JSON.stringify(result));
      return 0;
    }
    if (opts.command === 'sync') {
      if (!opts.commit || !opts.deployRun) throw new Error('sync needs --commit and --deploy-run');
      const result = syncSnapshot({ month, commit: opts.commit, deployRun: opts.deployRun, tracker: new PodiumTracker(), dryRun: Boolean(opts.dryRun) });
      console.log(JSON.stringify(result));
      return 0;
    }
    throw new Error('usage: catalog-recheck.mjs plan|run|sync [--month YYYY-MM] [--dry-run]');
  } catch (err) {
    if (err instanceof BlockedError) {
      console.error(`BLOCKED: ${err.message}. The ${monthKey(month)} plan above was computed but nothing was filed. Run this command from a host with an authenticated Podium CLI.`);
      return 3;
    }
    console.error(`error: ${err.message}`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
