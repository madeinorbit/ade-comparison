import { port } from './port.mjs';
const blog = 'nov12-blog-cloud-runners', cr = 'nov12-cloud-runners', dp = 'nov12-pricing';
const scope = { version: 'Delta 0.25.0 (docs, pricing and blog retrieved 2026-11-12)' };
port('zed-delta', {
  evidence: [{ id: blog, kind: 'vendor-claimed', sourceDate: '2026-11-11', url: 'https://delta.dev/blog/cloud-runners.md', title: 'Cloud Runners are now in Delta', locator: 'Full post',
    finding: 'Dated November 11, 2026: moving a thread to the cloud keeps the agent working without your computer; Cloud Runners are included free on every Zed plan except Student while Delta-specific plans are developed. No beta label. Personal Runners and browser shell access are not mentioned.' }],
  claims: {
    'RUN-01': { scope, answer: 'Local desktop turns use the sender’s checkout; since November 11, 2026 Cloud Runners run turns in a vendor Linux sandbox on every Zed plan except Student. Personal Runner access was not re-established after the launch.' ,
      subanswers: { byo_remote: { support: 'partial', answer: 'The Cloud Runners doc says a Personal Runner on your own computer must stay awake and connected; on 2026-11-07 its settings were gated with the Cloud Runners private beta, and whether that gate still applies after the Nov 11 launch was not established.', evidenceIds: [cr, 'nov07-runners', 'nov07-settings'] } } },
    'RUN-04': { scope, subanswers: { remote_setup: { support: 'partial', answer: 'Cloud Runners take a setup script and a preferred size and are open on every Zed plan except Student since Nov 11, 2026; Personal Runner setup access was not re-established.', evidenceIds: ['nov07-setup', cr, blog] } } },
    'OWN-06': { scope, subanswers: { access_restrictions: { support: 'supported', answer: 'Delta is a public beta; Cloud Runners are on every Zed plan except Student (since Nov 11, 2026), free under fair use until Delta plans roll out.', evidenceIds: ['nov07-install', cr, dp, blog] } } },
    'ACC-01': { scope, subanswers: { task_actions: { support: 'supported', answer: 'Desktop executes shell-backed tasks; the browser works on replicated files. Shell work from the browser needed a runner on 2026-11-07; whether launched Cloud Runners now provide it was not stated.', evidenceIds: ['nov07-install', 'nov07-web', 'nov07-cli', blog] } } },
    'ACC-03': { scope, subanswers: { provider_restrictions: { support: 'supported', answer: 'Custom endpoints are desktop-only; subscription sign-ins sync through Delta Cloud to devices and Cloud Runners, which are open on every Zed plan except Student since Nov 11, 2026.', evidenceIds: ['nov07-models', 'nov07-plans', cr, blog] } } },
  },
  mutate: p => { p.context.roadmapReview.gaps = p.context.roadmapReview.gaps.map(g => g.replace('Runners settings, including Personal Runners, are private-beta gated and are not positive remote-execution filter mappings.', 'Cloud Runners launched to every Zed plan except Student on 2026-11-11; Personal Runner access after that launch was not re-established.')); },
  summary: 'Follow-up to the Cloud Runners port: the dated launch post (Nov 11, 2026) confirms Cloud Runners on every Zed plan except Student, so atoms that still described runners as private-beta gated were rewritten. Personal Runner gating after the launch remains unknown and is stated as such.',
});
