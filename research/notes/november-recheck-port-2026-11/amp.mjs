import { port } from './port.mjs';
const ch = 'nov12-chronicle', sp = 'nov12-spaces', apps = 'nov12-apps';
const scope = { version: 'Amp docs and chronicle retrieved 2026-11-12 (news through Nov 10, 2026)' };
const ids = port('amp', {
  evidence: [
    { id: ch, kind: 'vendor-claimed', sourceDate: '2026-11-10', url: 'https://ampcode.com/chronicle', title: 'Amp Chronicle', locator: 'News, Oct 27 – Nov 10, 2026',
      finding: 'Dated news: Boxes, persistent always-on machines (Nov 10); Portals on your runner (Nov 9); Spaces (Nov 6); GitLab integration for gitlab.com or self-hosted (Nov 5); Service Accounts for team-owned threads (Nov 3); Artifacts (Nov 2); macOS Satellites (Oct 29); self-hosted orb providers (Oct 28); Amp on Android (Oct 27).' },
    { id: sp, url: 'https://ampcode.com/docs/spaces', title: 'Spaces', locator: 'Create a Space; threads; Slack; transfer; progress chart',
      finding: 'A Space has an optional Goal and Project, sharing and optional Slack channels. Amp starts a thread per request, shown as a card with live status and whether it needs attention. Existing threads can be added or moved with the threads they started; removed threads keep their history and environment. @Amp in a linked public Slack channel starts work. Teammates chat and comment; owners transfer ownership. A 30-day chart counts threads as Shipped, Archived or Open.' },
    { id: apps, url: 'https://ampcode.com/docs/apps', title: 'Amp apps', locator: 'Install; Sign in and accounts',
      finding: 'macOS 26+ on Apple silicon; iPhone/iPad iOS 26+ via TestFlight beta (no App Store release mentioned); Android 10+ via direct APK (no Google Play mentioned); Windows 10 1809+ or 11; Linux via apt, dnf or AUR on Debian 12+, Ubuntu 22.04+, Fedora and Arch, x86-64 or ARM64. Up to five accounts per device.' },
  ],
  claims: {
    'ACC-01': { scope, subanswers: {
      desktop_os: { support: 'supported', answer: 'macOS 26+ on Apple silicon; Windows 10 1809+ or 11; Linux packages for Debian 12+, Ubuntu 22.04+, Fedora and Arch on x86-64 or ARM64.', evidenceIds: [apps] },
      mobile_apps: { support: 'partial', answer: 'iPhone and iPad (iOS 26+) through a TestFlight beta, and Android 10+ through a direct APK; no store release is documented.', evidenceIds: [apps, ch] } } },
    'ACC-03': { scope, subanswers: { account_switching: { support: 'supported', answer: 'The apps keep up to five signed-in accounts per device.', evidenceIds: [apps] } } },
    'PLAN-03': { scope, subanswers: {
      epics: { support: 'partial', answer: 'A Space groups threads under an optional goal and project (since Nov 6, 2026); it is not a structured epic record.', evidenceIds: [sp, ch] },
      hierarchy: { support: 'supported', answer: 'Threads started by a thread move with it into or out of a Space.', evidenceIds: [sp] },
      task_to_epic: { support: 'supported', answer: 'Existing threads can be added to or moved between Spaces.', evidenceIds: [sp] },
      identity_retention: { support: 'supported', answer: 'A thread removed from a Space keeps its history and environment.', evidenceIds: [sp] } } },
    'PLAN-07': { scope, subanswers: { human_visibility: { support: 'supported', answer: 'Space cards show each thread’s live status and whether it needs someone.', evidenceIds: [sp] } } },
    'COORD-02': { scope, subanswers: { routing: { support: 'supported', answer: '@Amp in a public Slack channel linked to a workspace-shared Space starts work there.', evidenceIds: [sp] } } },
    'COORD-05': { scope, subanswers: { pending_decisions: { support: 'partial', answer: 'Space cards flag threads that need someone’s attention.', evidenceIds: [sp] } } },
    'RUN-06': { scope, subanswers: { project_stats: { support: 'partial', answer: 'A Space chart counts the last 30 days of threads as Shipped, Archived or Open (Done where commits cannot be seen).', evidenceIds: [sp] } } },
    'TEAM-01': { scope, subanswers: { comments: { support: 'supported', answer: 'Teammates comment in a Space; Amp reads a comment only when @amp is mentioned.', evidenceIds: [sp] } } },
    'TEAM-06': { scope, subanswers: { ownership: { support: 'partial', answer: 'A Space owner can transfer ownership once the recipient accepts; started threads stay with whoever started them.', evidenceIds: [sp] } } },
    'OWN-06': { scope, subanswers: { release_activity: { support: 'supported', answer: 'Dated releases include Android (Oct 27), Artifacts (Nov 2), Service Accounts (Nov 3), GitLab (Nov 5), Spaces (Nov 6) and Boxes (Nov 10, 2026).', evidenceIds: [ch] } } },
  },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: Spaces (Nov 6, 2026) as goal/project groupings with live thread cards, Slack routing, comments, transfer and progress chart; app platform minimums including Linux packages; iOS still a TestFlight beta and Android a direct APK (mobile_apps narrowed from supported to partial); five accounts per device; dated releases through Boxes (Nov 10). Documentation only; no hands-on test.',
});
console.log(ids.join(' '));
