import { port } from './port.mjs';
const app = 'nov12-cl-app-2-30', cli = 'nov12-cl-cli-1-5';
port('antigravity', {
  evidence: [
    { id: app, kind: 'vendor-claimed', sourceDate: '2026-11-09', url: 'https://antigravity.google/docs/changelog', title: 'Antigravity changelog', locator: 'Antigravity App 2.30.0 (November 9, 2026)',
      finding: 'Remote agents have finished rolling out to Google AI Ultra subscribers and to Google AI Pro subscribers on a paid plan; voice mode finished rolling out to everyone except business and enterprise accounts. App 2.31.0 (November 9) is labelled latest.' },
    { id: cli, kind: 'vendor-claimed', sourceDate: '2026-11-10', url: 'https://antigravity.google/docs/changelog', title: 'Antigravity changelog', locator: 'Antigravity CLI v1.5.0 (November 4, 2026); v1.5.4 (November 10, 2026)',
      finding: 'CLI 1.5.0 adds agy acp, running the CLI as an Agent Client Protocol server over stdio for editors, plus --remote-agent to run conversations on remote agents, /projects and partner MCP plugin sign-in. 1.5.4 adds Auto mode to agy acp sessions. The table of contents lists v1.5.5.' },
  ],
  claims: {
    'RUN-01': { scope: { version: 'Antigravity App 2.30.0 / CLI 1.5.4 (changelog retrieved 2026-11-12)' }, subanswers: {
      managed_cloud: { support: 'supported', answer: 'Remote Agents run in Google-managed environments that continue while local devices sleep; rollout finished in App 2.30.0 (Nov 9, 2026) for Google AI Ultra and paid Google AI Pro subscribers, and the CLI reaches them with --remote-agent. Separately the Gemini API offers preview managed sandboxes.', evidenceIds: [app, cli, 'remote-agents-nov07', 'managed-agent-nov07'] } } },
    'ACC-05': { scope: { version: 'Antigravity CLI 1.5.4 (changelog retrieved 2026-11-12)' }, subanswers: {
      cli: { support: 'supported', answer: 'agy -p runs headless with text, json and stream-json output and meaningful exit codes; since CLI 1.5.0 (Nov 4, 2026) agy acp runs it as an Agent Client Protocol server over stdio for editors, with Auto mode from 1.5.4.', evidenceIds: ['headless', cli] } } },
    'OWN-06': { scope: { version: 'Antigravity App 2.31.0 / CLI 1.5.4 (changelog retrieved 2026-11-12)' }, subanswers: {
      release_stage: { support: 'partial', answer: 'Remote Agents finished rolling out to Ultra and paid Pro subscribers in App 2.30.0; the SDK remains Alpha and the Gemini API agent is a separate preview.', evidenceIds: [app, 'sdk-repo-nov07', 'managed-agent-nov07'] },
      release_activity: { support: 'supported', answer: 'App 2.30.0 and 2.31.0 on November 9, 2026; CLI 1.5.0 on November 4 and 1.5.4 on November 10, 2026.', evidenceIds: [app, cli] } } },
  },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: Remote Agents rollout finished in App 2.30.0 (Nov 9, 2026) for Ultra and paid Pro subscribers; CLI 1.5.0 adds agy acp (ACP server) and --remote-agent, 1.5.4 Auto mode for ACP sessions. Documentation only; no hands-on test.',
});
const rn = 'nov12-release-notes';
port('factory', {
  evidence: [
    { id: rn, kind: 'vendor-claimed', sourceDate: '2026-11-11', url: 'https://docs.factory.com/changelog/release-notes.md', title: 'Factory release notes', locator: 'CLI v1.9.0 · Desktop v1.9.0 (November 11, 2026); CLI v1.7.0 · Desktop v1.7.0 (November 10, 2026) Improvements',
      finding: 'Newest entry is CLI and Desktop v1.9.0 dated November 11, 2026. Under v1.7.0 (November 10, 2026): Cloud Machine notices now name Environments as the replacement and link to Environments settings.' },
  ],
  claims: {
    'OWN-06': { scope: { version: 'Factory CLI/Desktop v1.9.0 (release notes retrieved 2026-11-12)' }, subanswers: {
      release_activity: { support: 'supported', answer: 'Near-daily releases; CLI and Desktop v1.9.0 dated November 11, 2026.', evidenceIds: [rn] },
      deprecation: { support: 'partial', answer: 'Cloud Machines are being deprecated: since v1.7.0 (Nov 10, 2026) their notices name Environments as the replacement. No end date was found.', evidenceIds: [rn] } } },
  },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: Cloud Machine deprecation notices name Environments as the replacement (v1.7.0, Nov 10, 2026); latest release v1.9.0 on Nov 11, 2026 (the source recheck had v1.8.0). Documentation only.',
});
