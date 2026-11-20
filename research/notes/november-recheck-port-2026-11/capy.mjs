import { port } from './port.mjs';
const cl = 'nov12-cl080', dl = 'nov12-download', pr = 'nov12-pricing-page', mc = 'nov12-machines', mp = 'nov12-models-and-pricing';
const scope = { version: 'Capy 0.8.0 (changelog, download, pricing and docs retrieved 2026-11-12)' };
const ids = port('capy', {
  evidence: [
    { id: cl, kind: 'vendor-claimed', sourceDate: '2026-11-10', url: 'https://capy.ai/changelog', title: 'Capy changelog', locator: 'Nov 10, 2026 — Capy 0.8.0',
      finding: '0.8.0 adds split panes; an Identity and access page with DNS-verified domains, Google Workspace sign-in as a paid add-on and other SAML or OIDC providers by contact; required MFA with passkeys, authenticator apps or backup codes; pinned comments on images and video frames sent together; PR guides ready in advance for Capy PRs; stack badges for Graphite, spr or hand-made chains; an Issues Display menu; voice input in every composer; Claude Fable 5.2, Morph and Ramp Router; Claude-subscription threads stay on one account. It says a cloud workspace asleep for more than 14 days is cleared; the thread stays and restarts from Setup.' },
    { id: dl, kind: 'vendor-claimed', url: 'https://capy.ai/download', title: 'Download Capy', locator: 'Platforms; FAQ',
      finding: 'Offers 0.8.0 for macOS Apple Silicon and Intel, Windows x64 and Linux x64/arm64. The subscription FAQ names ChatGPT (Codex), Copilot and SuperGrok; it no longer says a Claude subscription cannot be connected and does not mention Claude subscriptions.' },
    { id: pr, kind: 'vendor-claimed', url: 'https://capy.ai/pricing', title: 'Capy pricing', locator: 'Plans; comparison table; FAQ',
      finding: 'Lite $20/month ($16 annual) with $20 credits and a $1 first week on monthly Lite; Pro $100 ($80 annual) with $105 credits; Max $200–$1,000 at 110% credits; Enterprise custom. SSO / SAML is listed only for Enterprise; Google Workspace sign-in is not mentioned. FAQ names ChatGPT (Codex), GitHub Copilot and SuperGrok subscriptions.' },
    { id: mc, url: 'https://docs.capy.ai/machines', title: 'Machines', locator: 'Sleep; deletion',
      finding: 'A machine sleeps about 2 minutes after the thread stops; a machine that sleeps for 30 days is deleted; the disk survives sleep but processes do not.' },
    { id: mp, url: 'https://docs.capy.ai/models-and-pricing', title: 'Models and pricing', locator: 'Add a connection; Subscriptions',
      finding: 'A Claude Pro or Max plan connects through Claude Code with a claude setup-token token; Codex, GitHub Copilot and SuperGrok subscriptions run their plans’ models; own keys, gateways and subscriptions work on every plan, the free plan included.' },
  ],
  claims: {
    'ACC-01': { scope, subanswers: { desktop_os: { support: 'partial', answer: 'Stable 0.8.0 ships macOS Apple Silicon and Intel, Windows x64, and Linux x64 and arm64. The desktop app needs a desktop session; minimum OS versions were not established.', evidenceIds: [dl] } } },
    'ACC-02': { scope, subanswers: { model_providers: { support: 'supported', answer: 'Anthropic, OpenAI, Google, xAI and others, plus gateways, coding plans and custom OpenAI-compatible endpoints; 0.8.0 adds Claude Fable 5.2, Morph (own key) and Ramp Router as a gateway.', evidenceIds: [cl] } } },
    'ACC-03': { scope, contradictions: [],
      limitations: ['Remaining atomic behavior is unverified; this is a documentation pass, not a hands-on test.', 'The download and pricing pages list only ChatGPT (Codex), Copilot and SuperGrok subscriptions; they omit Claude but no longer say it cannot connect.'],
      subanswers: { agent_subscriptions: { support: 'supported', answer: 'Docs list Claude Pro or Max (as Claude Code), Codex, GitHub Copilot and SuperGrok subscriptions, and the 0.8.0 note covers Claude-subscription threads. The download and pricing pages name only ChatGPT, Copilot and SuperGrok but no longer say Claude cannot be connected.', evidenceIds: [mp, cl, dl, pr] } } },
    'PLAN-05': { scope, subanswers: { multimodal_inputs: { support: 'supported', answer: 'Images and files can be attached to thread or Slack prompts; 0.8.0 adds comments pinned on images and video frames and voice input in every composer.', evidenceIds: [cl] } } },
    'PLAN-06': { scope, subanswers: { project_epic_views: { support: 'partial', answer: 'Issue views cover For you, Assigned to me and Mentioned; sub-issues nest, and 0.8.0 adds a Display menu that groups and orders issues. An epic board was not established.', evidenceIds: [cl] } } },
    'RUN-01': { scope,
      contradictions: ['The 0.8.0 changelog (Nov 10, 2026) says a cloud workspace asleep for more than 14 days is cleared; docs.capy.ai/machines, retrieved 2026-11-12, still says a machine that sleeps for 30 days is deleted. Whether both describe the same storage is unresolved.'],
      subanswers: { expiry: { support: 'partial', answer: 'A machine sleeps about 2 minutes after work stops. The 0.8.0 note clears a workspace asleep for more than 14 days; the machines doc still says deletion after 30 days.', evidenceIds: [mc, cl] } } },
    'RUN-03': { scope,
      contradictions: ['The 0.8.0 changelog says sleeping cloud workspaces are cleared after more than 14 days; the machines doc retrieved 2026-11-12 still says 30 days.'],
      subanswers: {
        expiry: { support: 'partial', answer: 'Per 0.8.0, a cloud workspace asleep for more than 14 days is cleared; the thread stays and restarts from Setup, so unpushed edits are lost. The machines doc still says 30 days.', evidenceIds: [mc, cl] },
        multi_day_continuity: { support: 'partial', answer: 'Device threads wait up to 24 hours offline; a sleeping cloud workspace is kept up to 14 days per 0.8.0, 30 days per the machines doc.', evidenceIds: [mc, cl] } } },
    'TEAM-02': { scope, subanswers: {
      sso: { support: 'partial', answer: '0.8.0 adds Identity and access: DNS-verified domains, Google Workspace sign-in as a paid add-on, other SAML or OIDC providers by contact, and required MFA with passkeys or an authenticator app. Pricing still lists SSO / SAML only for Enterprise. Not tested.', evidenceIds: [cl, pr] },
      plan_scope: { support: 'partial', answer: 'Roles appear on every plan; pricing lists SSO and audit logging under Enterprise, and the 0.8.0 note sells Google Workspace sign-in as an add-on.', evidenceIds: [pr, cl] } } },
    'TEAM-05': { scope, subanswers: { comments: { support: 'supported', answer: 'Human PR comments wake the owning thread; 0.8.0 adds notes pinned on images and video frames, sent to Capy as one message.', evidenceIds: [cl] } } },
    'SHIP-06': { scope, subanswers: {
      summaries: { support: 'partial', answer: 'Pull requests get a guide; 0.8.0 groups each file into one chapter and has guides for Capy’s own pull requests ready before you look.', evidenceIds: [cl] },
      dependency_queues: { support: 'partial', answer: 'Stacks merge bottom-up, and a native stack merges below layers in one step; 0.8.0 stack badges also cover Graphite, spr and hand-made chains.', evidenceIds: [cl] } } },
    'OWN-06': { scope, subanswers: {
      release_stage: { support: 'supported', answer: 'Public desktop 0.8.0 and browser access; Captains and Issues are GA.', evidenceIds: [dl] },
      release_activity: { support: 'supported', answer: 'Releases 0.8.0 on Nov 10, 0.7.2 on Nov 1, 0.7.0 on Oct 31, 0.6.0 on Oct 27 and 0.5.0 on Oct 22, 2026.', evidenceIds: [cl] } } },
  },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: Capy 0.8.0 (Nov 10, 2026) SSO add-on and MFA, image/video comments, PR guide and stack badges, Issues Display menu, voice input, new models, and 14-day clearing of sleeping cloud workspaces, which contradicts the 30-day machines doc. The Claude-subscription contradiction on ACC-03 is cleared: capy.ai/download no longer says Claude cannot connect (it only omits it). Docs and changelog only; no hands-on test.',
  roadmap: { locations: [{ url: 'https://capy.ai/changelog', result: '2026-11-12: latest release 0.8.0 on Nov 10, 2026; released changes only, no dated future commitments.' }] },
});
console.log(ids.join(' '));
