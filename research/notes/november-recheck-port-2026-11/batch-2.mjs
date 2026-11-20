import { port } from './port.mjs';
const pv = 'nov12-cl-206';
port('superset', {
  evidence: [{ id: pv, kind: 'vendor-claimed', sourceDate: '2026-11-08', url: 'https://raw.githubusercontent.com/ParadevAI/Paradev/main/apps/marketing/content/changelog/2026-11-08-cloud-workspaces-browser-extensions.mdx', title: 'Cloud Workspaces Out of Beta and Chrome Extensions in the Browser', locator: 'Changelog source for paradev.com/changelog, 2026-11-08, version 2.0.6',
    finding: 'Version 2.0.6 (2026-11-08): cloud workspaces are out of beta and included in the Team and Ultra plans; Chrome extensions run in the browser pane; the chat interface is no longer experimental; Paradev moved from the Elastic License to MIT. Read from the repository source because paradev.com refuses automated fetches.' }],
  claims: {
    'RUN-01': { scope: { version: 'Paradev 2.0.6 (changelog source retrieved 2026-11-12)' }, subanswers: {
      managed_cloud: { support: 'supported', answer: 'Cloud workspaces left beta in 2.0.6 (2026-11-08) and are included in Team and Ultra; connected GitHub and agent accounts are required.', evidenceIds: [pv, 'cloud-current-nov07'] } } },
    'OWN-06': { scope: { version: 'Paradev 2.0.6 (changelog source retrieved 2026-11-12)' }, subanswers: {
      release_activity: { support: 'supported', answer: 'Version 2.0.6 shipped on 2026-11-08 after desktop-v2.0.5 on November 5.', evidenceIds: [pv] } } },
  },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: cloud workspaces out of beta in 2.0.6 (2026-11-08) on Team and Ultra; chat interface no longer experimental. Read from the ParadevAI/Paradev changelog source because paradev.com returns 403 to automated fetches.',
});

const kc = 'nov12-changelog';
port('kiro', {
  evidence: [{ id: kc, kind: 'vendor-claimed', sourceDate: '2026-11-11', url: 'https://kiro.dev/changelog/', title: 'Kiro changelog', locator: 'Entries Nov 4 – Nov 11, 2026',
    finding: 'CLI 3.2.1 (Nov 11); Enterprise Management preview sets one policy for IDE, CLI, Kiro Web and Kiro Crew LTS, for new profiles in US East (N. Virginia) (Nov 10); Kiro Crew LTS (Nov 10); IDE 1.4.154 adds Approve for me and turns the Autopilot toggle into a permission-mode menu: Supervised, Accept file changes, Approve for me (Nov 10); CLI 3.2.0 (Nov 10); Kiro Web Approve for me, where a model approves, blocks or asks about agent actions (Nov 6); CLI 3.1.0 shows session credits used in /usage (Nov 5).' }],
  claims: {
    'TEAM-03': { scope: { version: 'Kiro IDE 1.4.154 / CLI 3.2.1 (changelog retrieved 2026-11-12)' }, subanswers: {
      safer_modes: { support: 'supported', answer: 'The sandbox is separate from command permissions and cloud sandboxing; IDE 1.4.154 adds a permission-mode menu (Supervised, Accept file changes, Approve for me) and Kiro Web has model-based Approve for me.', evidenceIds: ['nov07-sandbox', kc] },
      enforcement: { support: 'partial', answer: 'Claude Code tools preapproved in Claude settings can bypass Crew approval, deny and audit observation; Codex refuses to start with Crew sandbox off. Enterprise Management (preview, new US East profiles) sets one policy across IDE, CLI, Web and Crew LTS; enforcement was not tested.', evidenceIds: ['gap07-backends', kc] } } },
    'RUN-07': { scope: { version: 'Kiro CLI 3.1.0+ (changelog retrieved 2026-11-12)' }, subanswers: {
      session_cost: { support: 'supported', answer: 'Since CLI 3.1.0 (Nov 5, 2026) /usage shows the credits the current session has used.', evidenceIds: [kc] } } },
    'OWN-06': { scope: { version: 'Kiro changelog retrieved 2026-11-12' }, subanswers: {
      release_stage: { support: 'partial', answer: 'Enterprise Management is in preview for new profiles in US East (N. Virginia); other release stages were not re-checked in this port.', evidenceIds: [kc] },
      release_activity: { support: 'supported', answer: 'Frequent releases: IDE 1.4.121 and CLI 3.1.0 (Nov 5), IDE 1.4.154 and CLI 3.2.0 (Nov 10), CLI 3.2.1 (Nov 11, 2026).', evidenceIds: [kc] } } },
  },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: Approve for me and permission-mode menu (IDE 1.4.154, Web), Enterprise Management preview, CLI /usage session credits, and releases through CLI 3.2.1. Not ported: CLI 3.0.0 retiring the Classic interface and desktop app, and credit pooling, because the current changelog page no longer shows entries before Nov 4.',
});

const cr = 'nov12-cloud-runners', dp = 'nov12-pricing', dr = 'nov12-release-notes';
port('zed-delta', {
  type: 'product-change',
  evidence: [
    { id: cr, url: 'https://delta.dev/docs/agents/cloud-runners.md', title: 'Cloud Runners', locator: 'Sizes; billing and limits; terminals',
      finding: 'The page no longer describes Cloud Runners as private beta or access-gated. Small 2 CPU/4 GB/15 GB disk, Medium (default) 4/8/30, Large 8/16/50; compute free until Delta plans roll out, with fair-use limits; model usage billed separately; a runner pauses when its time allowance expires and after 10 idle minutes; terminals close after one hour; the agent keeps working while the laptop sleeps; not available on Student plans.' },
    { id: dp, kind: 'vendor-claimed', url: 'https://delta.dev/pricing', title: 'Delta pricing', locator: 'Plans; FAQ',
      finding: 'Cloud Runners are listed on Personal (and so Pro) and the FAQ says every Zed plan except Student includes them; free for now, which may change with Delta-specific plans. Delta overall is labelled beta.' },
    { id: dr, kind: 'vendor-claimed', sourceDate: '2026-11-11', url: 'https://delta.dev/docs/whats-in-the-latest.md', title: 'What’s in the latest', locator: '0.24.0 – 0.25.0',
      finding: 'Releases 0.24.0 (Nov 4), 0.24.1 (Nov 9), 0.24.2 (Nov 10) and 0.25.0 (Nov 11, 2026).' },
  ],
  claims: {
    'RUN-01': { scope: { version: 'Delta 0.25.0 (docs and pricing retrieved 2026-11-12)' }, subanswers: {
      managed_cloud: { support: 'supported', answer: 'Cloud Runners run a thread’s agent turns in a vendor Linux sandbox on every Zed plan except Student; Delta itself is a public beta.', evidenceIds: [cr, dp] },
      payer: { support: 'partial', answer: 'Runner compute is free until Delta plans roll out, under fair-use limits; model usage is billed separately.', evidenceIds: [cr, dp] },
      resources: { support: 'supported', answer: 'Small 2 CPU/4 GB, Medium 4 CPU/8 GB (default), Large 8 CPU/16 GB, with 15/30/50 GB free disk.', evidenceIds: [cr] },
      expiry: { support: 'partial', answer: 'A runner pauses after 10 idle minutes or when its time allowance expires; terminals close one hour after starting.', evidenceIds: [cr] },
      client_disconnect: { support: 'supported', answer: 'On a Cloud Runner the agent keeps working while the laptop sleeps; a Personal Runner needs its computer awake.', evidenceIds: [cr] } } },
    'OWN-06': { scope: { version: 'Delta 0.25.0 (release notes retrieved 2026-11-12)' }, subanswers: {
      release_activity: { support: 'supported', answer: '0.24.0 (Nov 4), 0.24.1 (Nov 9), 0.24.2 (Nov 10) and 0.25.0 (Nov 11, 2026).', evidenceIds: [dr] } } },
  },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: Cloud Runners are no longer described as private beta; docs and pricing offer them on every Zed plan except Student, free under fair use until plans roll out, with published sizes, pause rules and a one-hour terminal limit. RUN-01.managed_cloud moves from partial (private beta) to supported. Releases through 0.25.0 (Nov 11).',
});

const c94 = 'nov12-cl-0940';
port('conductor', {
  evidence: [{ id: c94, kind: 'vendor-claimed', sourceDate: '2026-11-09', url: 'https://www.conductor.build/changelog/0.94.0-claude-fable-5-2', title: 'Conductor 0.94.0', locator: 'Release notes',
    finding: '0.94.0 dated November 9, 2026: Claude Fable 5.2, more reliable update checks, Codex follow-up and Artifacts fixes, Cloud shutdown banner link fix, bundled Claude Code 2.1.321 and Codex 0.166.0. No newer release linked.' }],
  claims: { 'OWN-06': { scope: { version: 'Conductor 0.94.0 (retrieved 2026-11-12)' }, subanswers: {
    release_activity: { support: 'supported', answer: 'Latest listed release is 0.94.0 on November 9, 2026, after 0.93.0 on November 4.', evidenceIds: [c94] } } } },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: release 0.94.0 (Nov 9, 2026). Lifecycle notice unchanged.',
});

const oc = 'nov12-releases';
port('opencode', {
  evidence: [{ id: oc, kind: 'vendor-claimed', sourceDate: '2026-11-10', url: 'https://github.com/anomalyco/opencode/releases', title: 'opencode releases', locator: 'v2.2.7; v2.2.6; process-daemon v0.5.2',
    finding: 'v2.2.7 (10 Nov 2026) adds GitHub Copilot Auto model selection, side-panel tab shortcuts and Mark as unread for sessions, and removes ImageResponse.image from @opencode/ai; v2.2.6 on 6 Nov; process-daemon v0.5.2 on 11 Nov.' }],
  claims: { 'OWN-06': { scope: { version: 'opencode v2.2.7 (releases retrieved 2026-11-12)' }, subanswers: {
    release_activity: { support: 'supported', answer: 'v2.2.6 (Nov 6) and v2.2.7 (Nov 10, 2026), plus process-daemon v0.5.2 (Nov 11).', evidenceIds: [oc] } } } },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: release activity through v2.2.7 (Nov 10, 2026).',
});
