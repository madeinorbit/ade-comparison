import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPlan, chunk, monthKey, runMonth, PodiumTracker, BlockedError, main, CONFIG } from './catalog-recheck.mjs';

const runManual = (opts) => runMonth({ parentId: 'PDM-257', ...opts });

const NOW = new Date('2026-12-01T09:00:00Z');

function fixture({ profiles = 23, register = 12 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'catalog-recheck-'));
  mkdirSync(join(root, 'research', 'products'), { recursive: true });
  for (let i = 0; i < profiles; i++) {
    const id = `p${String(i).padStart(3, '0')}`;
    writeFileSync(join(root, 'research', 'products', `${id}.json`), JSON.stringify({
      id, name: id, researchState: 'documented',
      claims: [
        { checkedAt: '2026-09-01', nextReviewAt: '2026-11-01' },
        { checkedAt: '2026-11-17', nextReviewAt: '2027-02-17' },
      ],
    }));
  }
  const entries = Array.from({ length: register }, (_, i) => ({ id: `q${String(i).padStart(3, '0')}`, name: `q${i}`, researchTier: i % 6 ? 'qualification' : 'watch', category: 'D' }));
  entries.push({ id: 'p000', name: 'p000', researchTier: 'full-profile', category: 'A' });
  writeFileSync(join(root, 'research', 'registry.json'), JSON.stringify({ products: entries }));
  return root;
}

const digest = (root) => {
  const h = createHash('sha256');
  for (const f of readdirSync(join(root, 'research', 'products')).sort()) h.update(readFileSync(join(root, 'research', 'products', f)));
  h.update(readFileSync(join(root, 'research', 'registry.json')));
  return h.digest('hex');
};

// In-memory stand-in for the Podium tracker with the same surface as PodiumTracker.
class FakeTracker {
  constructor() { this.issues = []; this.artifacts = new Map(); this.started = []; this.calls = []; this.failAfterCreates = Infinity; }
  ping() {}
  findByTitle(title, key) { return this.issues.filter((i) => i.title === title); }
  children(ref) { return this.issues.filter((i) => i.parentId === ref); }
  create(f) {
    if (this.issues.length >= this.failAfterCreates) throw new Error('simulated crash');
    const issue = { id: `iss_${this.issues.length}`, displayRef: `ADE-${900 + this.issues.length}`, stage: 'backlog', deps: [], ...f };
    this.issues.push(issue); this.calls.push(['create', f.title]); return issue;
  }
  depAdd(from, to) {
    const a = this.issues.find((i) => i.displayRef === from); const b = this.issues.find((i) => i.displayRef === to);
    if (a.deps.some((d) => d.id === b.id)) throw new Error('duplicate edge');
    a.deps.push({ id: b.id, type: 'blocked-by' }); this.calls.push(['dep', from, to]);
  }
  getArtifact(ref, name) { return this.artifacts.get(`${ref}/${name}`) ?? null; }
  addArtifact(ref, name, content) { this.artifacts.set(`${ref}/${name}`, content); this.calls.push(['artifact', ref, name]); }
  start(ref) { this.started.push(ref); }
}

const quiet = () => {};

test('month keys and batch limits', () => {
  assert.equal(monthKey('2026-12'), 'ade-catalog-recheck:2026-12');
  assert.throws(() => monthKey('2026-13'));
  assert.throws(() => monthKey('26-12'));
  assert.throws(() => chunk([1], 12));
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('plan enumerates the catalog at run time in batches of at most 11', () => {
  const root = fixture();
  try {
    const plan = buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' });
    assert.equal(plan.title, 'Catalog recheck 2026-12');
    assert.equal(plan.counts.profiles, 23);
    assert.equal(plan.counts.register, 12, 'full profiles in the registry are not double-counted');
    assert.deepEqual(plan.tasks.map((t) => t.productIds.length), [11, 11, 1, 11, 1]);
    assert.ok(plan.tasks.every((t) => t.productIds.length <= 11));
    assert.deepEqual(plan.review.waitsOn, plan.tasks.map((t) => t.key));
    // Evidence age is reported as recorded, including past-due claims.
    assert.deepEqual({ ...plan.profiles[0], id: undefined, name: undefined, researchState: undefined },
      { id: undefined, name: undefined, researchState: undefined, oldestCheckedAt: '2026-09-01', newestCheckedAt: '2026-11-17', overdueClaims: 1 });
    // A product added later in the month changes the next enumeration.
    writeFileSync(join(root, 'research', 'products', 'zzz.json'), JSON.stringify({ id: 'zzz', name: 'zzz', claims: [] }));
    assert.equal(buildPlan({ root, month: '2027-01', now: NOW, commit: 'def5678' }).counts.profiles, 24);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('dry run files nothing, and the planner never edits research files', () => {
  const root = fixture();
  try {
    const before = digest(root);
    const plan = buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' });
    const tracker = new FakeTracker();
    const lines = [];
    const result = runManual({ plan, tracker, parentId: 'PDM-257', start: true, dryRun: true, log: (l) => lines.push(l) });
    assert.equal(tracker.issues.length, 0);
    assert.equal(tracker.started.length, 0);
    assert.equal(result.actions.length, 1 + 1 + 5 + 1 + 5 + 1, 'issue, manifest, 5 batches, review, 5 edges, start');
    assert.ok(lines.every((l) => l.startsWith('[dry-run] ')));
    assert.equal(digest(root), before, 'evidence dates untouched');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('first run files every task and the review before starting; reruns resume without duplicates', () => {
  const root = fixture();
  try {
    const plan = buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' });
    const tracker = new FakeTracker();
    const first = runManual({ plan, tracker, parentId: 'PDM-257', start: true, log: quiet });
    assert.equal(first.resumed, false);
    const month = tracker.issues[0];
    assert.equal(month.title, 'Catalog recheck 2026-12');
    assert.equal(month.parentId, 'PDM-257');
    assert.match(month.brief, /Idempotency key: ade-catalog-recheck:2026-12/);
    const kids = tracker.children(month.displayRef);
    assert.equal(kids.length, 6);
    const review = kids.find((k) => k.title === 'Independent recheck review');
    assert.equal(review.deps.length, 5);
    assert.match(review.brief, /catalog-recheck\.mjs sync --month 2026-12/);
    assert.ok(kids.every((k) => /never extend or restamp dates/.test(k.brief)));
    // start comes strictly after all filing
    assert.deepEqual(tracker.started, [month.displayRef]);
    assert.ok(JSON.parse(tracker.getArtifact(month.displayRef, 'catalog-manifest.json')).tasks.length === 5);

    const count = tracker.issues.length;
    const again = runManual({ plan: buildPlan({ root, month: '2026-12', now: NOW, commit: 'later99' }), tracker, start: false, log: quiet });
    assert.equal(again.resumed, true);
    assert.equal(again.issue, month.displayRef);
    assert.equal(tracker.issues.length, count, 'no duplicate issues');
    assert.deepEqual(again.actions, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a crashed run resumes from the frozen manifest even if the catalog changed', () => {
  const root = fixture();
  try {
    const tracker = new FakeTracker();
    tracker.failAfterCreates = 3; // month issue + 2 batches, then crash
    assert.throws(() => runManual({ plan: buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' }), tracker, start: true, log: quiet }), /simulated crash/);
    assert.equal(tracker.started.length, 0, 'nothing starts before every task is filed');
    writeFileSync(join(root, 'research', 'products', 'zzz.json'), JSON.stringify({ id: 'zzz', name: 'zzz', claims: [] }));
    tracker.failAfterCreates = Infinity;
    const r = runManual({ plan: buildPlan({ root, month: '2026-12', now: NOW, commit: 'new0000' }), tracker, start: true, log: quiet });
    assert.equal(r.resumed, true);
    const kids = tracker.children(r.issue);
    assert.equal(kids.length, 6, 'stored 5 batches + review, not recomputed');
    assert.equal(new Set(kids.map((k) => k.title)).size, 6);
    assert.equal(kids.find((k) => k.title === 'Independent recheck review').deps.length, 5);
    assert.deepEqual(tracker.started, [r.issue]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a closed month is reported, not refiled; duplicates stop the run', () => {
  const root = fixture();
  try {
    const plan = buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' });
    const tracker = new FakeTracker();
    runManual({ plan, tracker, log: quiet });
    tracker.issues[0].stage = 'done';
    const r = runManual({ plan, tracker, start: true, log: quiet });
    assert.equal(r.closed, true);
    assert.equal(tracker.started.length, 0);
    tracker.issues.push({ ...tracker.issues[0], id: 'dup', displayRef: 'ADE-999' });
    assert.throws(() => runManual({ plan, tracker, log: quiet }), /more than one issue/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing Podium CLI is reported as a blocker with exit code 3', () => {
  assert.throws(() => new PodiumTracker({ bin: 'podium-not-installed-here' }).ping(), BlockedError);
  const prevBin = process.env.ADE_RECHECK_PODIUM_BIN;
  process.env.ADE_RECHECK_PODIUM_BIN = 'podium-not-installed-here';
  const origErr = console.error, origLog = console.log;
  const errs = [];
  console.error = (m) => errs.push(m); console.log = quiet;
  try {
    assert.equal(main(['run', '--month', '2026-12', '--start']), 3);
    assert.match(errs.join(' '), /BLOCKED: Podium CLI "podium-not-installed-here" is not installed/);
  } finally {
    console.error = origErr; console.log = origLog;
    if (prevBin === undefined) delete process.env.ADE_RECHECK_PODIUM_BIN; else process.env.ADE_RECHECK_PODIUM_BIN = prevBin;
  }
});

test('fresh scheduled draft becomes the monthly issue without a closed setup parent', () => {
  const root = fixture({ profiles: 1, register: 1 });
  try {
    const tracker = new FakeTracker();
    const draft = { id: 'draft-user-assigned', displayRef: 'ADE-800', draft: true, title: 'Scheduled task', stage: 'backlog', brief: '', deps: [] };
    tracker.issues.push(draft);
    tracker.currentIssue = () => ({ ...draft });
    tracker.adoptDraft = (current, fields) => {
      assert.equal(current.id, draft.id);
      Object.assign(draft, fields, { draft: false, stage: 'in_progress' });
      return draft;
    };
    tracker.coordinate = (ref) => tracker.calls.push(['coordinate', ref]);
    const plan = buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' });
    const r = runMonth({ plan, tracker, parentId: null, start: true, log: quiet });
    assert.equal(r.issue, 'ADE-800');
    assert.equal(draft.draft, false);
    assert.equal(draft.parentId, null);
    assert.equal(tracker.issues.length, 4, 'same monthly issue, two batches, one review');
    assert.deepEqual(tracker.started, [], 'the scheduled coordinator does not spawn a duplicate of itself');
    assert.deepEqual(tracker.calls.at(-1), ['coordinate', 'ADE-800']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a real issue or Proposed record cannot be renamed into a fresh monthly campaign', () => {
  const root = fixture({ profiles: 1, register: 0 });
  try {
    const plan = buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' });
    const tracker = new FakeTracker();
    tracker.currentIssue = () => ({ id: 'real', draft: false, title: 'Other task', stage: 'in_progress' });
    assert.throws(() => runMonth({ plan, tracker, parentId: null, log: quiet }), /fresh scheduled draft/);
    assert.equal(tracker.issues.length, 0);
    const real = new PodiumTracker({ exec: () => { throw Error('must not mutate'); } });
    assert.throws(() => real.adoptDraft({ id: 'proposal', draft: false, stage: 'proposed' }, {}), BlockedError);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an existing unkeyed monthly title prevents a duplicate without being changed', () => {
  const root = fixture({ profiles: 1, register: 0 });
  try {
    const tracker = new FakeTracker();
    tracker.issues.push({ id: 'human-month', displayRef: 'ADE-700', title: 'Catalog recheck 2026-12', brief: 'Manually filed', stage: 'backlog' });
    const result = runMonth({ plan: buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' }), tracker, parentId: null, start: true, log: quiet });
    assert.equal(result.issue, 'ADE-700');
    assert.equal(result.needsAdoption, true);
    assert.equal(tracker.issues.length, 1);
    assert.deepEqual(tracker.started, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('created work preserves the requested agent and starts from current remote main', () => {
  const calls = [];
  const tracker = new PodiumTracker({ exec: (bin, args) => {
    calls.push(args);
    return JSON.stringify({ ok: true, data: { id: 'created', displayRef: 'ADE-701' } });
  } });
  tracker.create({ title: 'Source batch 01', description: 'Recheck sources.', brief: 'Bounded research.', parentId: 'ADE-700' });
  const args = calls[0];
  assert.equal(args[args.indexOf('--agent') + 1], 'claude-code');
  assert.equal(args[args.indexOf('--model') + 1], 'claude-opus-5-5');
  assert.equal(args[args.indexOf('--effort') + 1], 'medium');
  assert.equal(args[args.indexOf('--parent-branch') + 1], 'origin/main');
  assert.equal(CONFIG.parentId, null, 'a recurring campaign must not depend on the one-off setup issue staying open');
});

test('native issue context reads the real CLI prime envelope and verifies the draft record', () => {
  const draft = { id: 'draft', displayRef: 'ADE-800', draft: true, stage: 'backlog' };
  const tracker = new PodiumTracker({ exec: (bin, args) => {
    const data = args[1] === 'prime'
      ? { prime: 'This session is attached to a draft work item (ADE-800).\nName the request.' }
      : draft;
    return JSON.stringify({ ok: true, data });
  } });
  assert.deepEqual(tracker.currentIssue(), draft);
  const mismatch = new PodiumTracker({ exec: (bin, args) => JSON.stringify({ ok: true, data:
    args[1] === 'prime' ? { prime: 'This session is attached to a draft work item (ADE-800).' } : { ...draft, draft: false } }) });
  assert.throws(() => mismatch.currentIssue(), /does not match/);
});

test('a retry attaches the fresh scheduled session to its existing month without a second coordinator', () => {
  const root = fixture({ profiles: 1, register: 0 });
  try {
    const tracker = new FakeTracker();
    const plan = buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' });
    runManual({ plan, tracker, log: quiet });
    const month = tracker.issues[0], count = tracker.issues.length;
    tracker.currentIssue = () => ({ id: 'new-draft', displayRef: 'ADE-800', draft: true, stage: 'backlog' });
    tracker.attach = (ref) => tracker.calls.push(['attach', ref]);
    tracker.coordinate = (ref) => { tracker.calls.push(['coordinate', ref]); month.stage = 'in_progress'; };
    const result = runMonth({ plan, tracker, parentId: null, start: true, log: quiet });
    assert.equal(result.resumed, true);
    assert.equal(tracker.issues.length, count);
    assert.deepEqual(tracker.started, []);
    assert.deepEqual(tracker.calls.slice(-2), [['attach', month.displayRef], ['coordinate', month.displayRef]]);
    assert.equal(month.stage, 'in_progress');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a retry never activates a Proposed month or reopens a campaign ready for review', () => {
  const root = fixture({ profiles: 1, register: 0 });
  try {
    const tracker = new FakeTracker();
    const plan = buildPlan({ root, month: '2026-12', now: NOW, commit: 'abc1234' });
    tracker.issues.push({ id: 'month', displayRef: 'ADE-700', title: plan.title, brief: plan.key, stage: 'proposed' });
    assert.throws(() => runMonth({ plan, tracker, parentId: null, start: true, log: quiet }), /requires an operator/);
    assert.equal(tracker.issues.length, 1);
    tracker.issues[0].stage = 'review';
    assert.equal(runMonth({ plan, tracker, parentId: null, start: true, log: quiet }).reviewReady, true);
    assert.deepEqual(tracker.started, []);
    assert.equal(tracker.issues[0].stage, 'review');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('routine config fires monthly at 09:00 UTC and only calls the handler', () => {
  const dir = new URL('./catalog-recheck/', import.meta.url);
  const routine = JSON.parse(readFileSync(new URL('routine.json', dir), 'utf8'));
  const prompt = readFileSync(new URL('routine-prompt.md', dir), 'utf8');
  assert.equal(routine.cron_expression, '0 9 1 * *');
  assert.equal(routine.clear_mcp_connections, true);
  assert.deepEqual(routine.allowed_tools, ['Bash', 'Read']);
  assert.match(prompt, /node research\/catalog-recheck\.mjs run --month "\$MONTH" --start/);
  assert.match(prompt, /git checkout --detach origin\/main/);
  assert.match(prompt, /Do not edit, commit or push/);
});
