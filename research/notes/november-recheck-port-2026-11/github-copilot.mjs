import { port } from './port.mjs';
const plans = 'nov12-plans', ind = 'nov12-ind-plans', ubb = 'nov12-ubb-ind', legacy = 'nov12-legacy-requests', sbx = 'nov12-sandbox-billing',
  cloud = 'nov12-cl-cloud-exp', ent = 'nov12-cl-ent-copilot', app = 'nov12-app-release', cli = 'nov12-cli-releases', train = 'nov12-training';
const scope = { version: 'GitHub Copilot plans, billing docs and changelog retrieved 2026-11-12 (app v1.2.0, CLI v1.0.109)' };
const ids = port('github-copilot', {
  evidence: [
    { id: plans, kind: 'vendor-claimed', url: 'https://github.com/features/copilot/plans', title: 'GitHub Copilot plans', locator: 'Plan cards; comparison table',
      finding: 'Free $0 with no credit card, 2,000 completions a month and limited chat/agent use; Pro $10 ($15 of credits), Pro+ $39 ($70), Max $100 ($200); 1 AI credit = $0.01 USD; budget alerts at 75%, 90% and 100%; Free cannot buy extra credits.' },
    { id: ind, url: 'https://docs.github.com/en/copilot/concepts/billing/individual-plans', title: 'GitHub Copilot plans (docs)', locator: 'Individual plans; organization and enterprise plans',
      finding: 'USD prices. Pro $10 with 1,000 base + 500 flex credits, Pro+ $39 with 3,900 + 3,100, Max $100 with 10,000 + 10,000. Business $19 per granted seat with 1,900 credits per user; Enterprise $39 with 3,900; Copilot access $0 for GitHub Enterprise Cloud license holders or $10 Standalone with no included credits. Copilot is not available for GHES.' },
    { id: ubb, url: 'https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals', title: 'Usage-based billing for individuals', locator: 'Pricing; allotments; discounts; cancellation',
      finding: 'Interactions are priced per model and token and converted to AI credits ($0.01 each). Base credits are fixed; the flex allotment may change. Allowance resets on the 1st at 00:00 UTC with no carry-over. Chat, CLI, cloud agent, Spaces, Spark and third-party agents consume credits; completions stay unlimited on paid plans. 10% discount for auto model selection; 30% Fusion discount through 2026-11-30. Cancellation takes effect at cycle end, with incurred usage still owed.' },
    { id: legacy, url: 'https://docs.github.com/en/copilot/concepts/billing/copilot-requests', title: 'Requests in GitHub Copilot', locator: 'Who is billed in premium requests',
      finding: 'Premium-request billing (Pro 300, Pro+ 1,500 per month, $0.04 per extra request) now applies only to Pro and Pro+ subscribers on existing annual plans who stayed on legacy billing after 2026-06-01.' },
    { id: sbx, url: 'https://docs.github.com/en/billing/concepts/product-billing/cloud-and-local-sandboxes', title: 'Billing for cloud and local sandboxes', locator: 'Rates; allowance; who pays; budgets',
      finding: 'Cloud sandboxes bill $0.000024 per compute second, $0.000003 per allocated GiB-second and $0.005 per GiB-month of snapshot storage. Compute and memory draw from the plan’s included compute pool shared with GitHub-hosted runners; the repository owner (or selected/personal account) pays; product or SKU budgets can stop usage at 100%; AI-credit budgets do not apply. Local sandboxing is included in the seat.' },
    { id: cloud, kind: 'vendor-claimed', sourceDate: '2026-10-28', url: 'https://github.blog/changelog/2026-10-28-work-from-anywhere-with-a-new-connected-copilot-cloud-experience', title: 'Work from anywhere with a new connected Copilot cloud experience', locator: 'Full entry',
      finding: 'GA on paid plans from 2026-10-28: cloud tasks start from github.com, GitHub Mobile, CLI, app, VS Code, Slack or Teams; every session runs in a cloud sandbox by default with no one-hour limit on total running time; sandboxes snapshot on shutdown and resume from any surface; the included Actions entitlement becomes one dollar-based pool, with sandbox billing starting in November 2026; --environment-host registers your own machine. Free keeps Chat on github.com and Mobile only.' },
    { id: ent, kind: 'vendor-claimed', sourceDate: '2026-10-28', url: 'https://github.blog/changelog/2026-10-28-github-enterprise-now-includes-access-to-github-copilot', title: 'GitHub Enterprise now includes access to GitHub Copilot', locator: 'Full entry',
      finding: 'Enterprises with a GitHub or Microsoft account team get Copilot for every licensed user, metered against the enterprise budget from the first request with no included credits; Copilot Standalone is $10 per user per month; completions keep working with no budget; self-serve is not yet available.' },
    { id: app, kind: 'vendor-claimed', sourceDate: '2026-11-10', url: 'https://github.com/github/app/releases/tag/v1.2.0', title: 'GitHub Copilot app v1.2.0', locator: 'Release notes',
      finding: 'Published 10 Nov (2026): Open in menu with QR hand-off of cloud and Codespace sessions to GitHub Mobile, GHES accounts, custom-field filters for issues and PRs, minute-precise and cron automation schedules, multilingual dictation.' },
    { id: cli, kind: 'vendor-claimed', sourceDate: '2026-11-10', url: 'https://github.com/github/copilot-cli/releases', title: 'github/copilot-cli releases', locator: 'Latest release',
      finding: 'Latest release v1.0.109 on 2026-11-10; v1.0.110-0 to -3 are pre-releases.' },
    { id: train, sourceDate: '2026-03-25', url: 'https://github.blog/news-insights/company-news/updates-to-github-copilot-interaction-data-usage-policy/', title: 'Updates to GitHub Copilot interaction data usage policy', locator: 'Full post',
      finding: 'From 2026-04-24, interaction data from Copilot Free, Pro and Pro+ is used to train models unless the user opts out under Privacy in Copilot settings; Business, Enterprise, enterprise-owned repositories and private repository content at rest are excluded. No later amendment on the page.' },
  ],
  claims: {
    'OWN-04': { scope, subanswers: {
      currency: { support: 'supported', answer: 'Prices are in US dollars.', evidenceIds: [ind] },
      interval: { support: 'supported', answer: 'Monthly: Pro $10, Pro+ $39, Max $100; Business $19 and Enterprise $39 per granted seat. Pro and Pro+ annual plans that stayed on legacy billing after 2026-06-01 keep premium requests.', evidenceIds: [ind, legacy] },
      seats: { support: 'supported', answer: 'Individual plans are per user; Business and Enterprise are per granted seat; Copilot access is $0 for Enterprise Cloud license holders or $10 Standalone.', evidenceIds: [ind, ent] },
      included_usage: { support: 'supported', answer: 'Pro 1,500 credits (1,000 base + 500 flex), Pro+ 7,000, Max 20,000; Business 1,900 and Enterprise 3,900 per user; Copilot access has none. Completions stay unlimited on paid plans. Credit amounts are not task counts.', evidenceIds: [ind, ubb] },
      credits: { support: 'supported', answer: '1 AI credit = $0.01; usage is priced per model and token; base credits are fixed, the flex allotment may change, and nothing carries over.', evidenceIds: [plans, ubb] },
      model_cost: { support: 'supported', answer: 'Per-token rates by model, converted to credits; 10% discount for auto model selection and 30% for Fusion through 2026-11-30.', evidenceIds: [ubb] },
      compute_cost: { support: 'supported', answer: 'Cloud sandboxes: $0.000024 per compute second, $0.000003 per allocated GiB-second, $0.005 per GiB-month of snapshots, drawn from the shared compute pool.', evidenceIds: [sbx] } } },
    'OWN-09': { scope, subanswers: {
      included_limits: { support: 'supported', answer: 'Published monthly credit allowances per plan; Copilot access via Enterprise has no included credits.', evidenceIds: [ind, ent] },
      cancellation: { support: 'supported', answer: 'Individual cancellation takes effect at the end of the billing cycle; usage already incurred is still owed.', evidenceIds: [ubb] },
      sales_only_unknowns: { support: 'partial', answer: 'Copilot included with GitHub Enterprise goes through account teams; self-serve is not yet available.', evidenceIds: [ent] } } },
    'OWN-08': { scope, subanswers: {
      card_required: { support: 'supported', answer: 'Free needs no credit card.', evidenceIds: [plans] },
      usage_caps: { support: 'supported', answer: 'Free has 2,000 completions a month and limited chat and agent use, and cannot buy extra credits.', evidenceIds: [plans] },
      paid_evaluation: { support: 'supported', answer: 'Copilot in the cloud needs a paid plan; Free keeps Chat on github.com and GitHub Mobile only.', evidenceIds: [cloud] } } },
    'OWN-06': { scope, subanswers: {
      release_stage: { support: 'supported', answer: 'The connected cloud experience is GA on paid plans from 2026-10-28.', evidenceIds: [cloud] },
      release_activity: { support: 'supported', answer: 'Copilot app v1.2.0 and CLI v1.0.109 both shipped on 2026-11-10; CLI pre-releases continue.', evidenceIds: [app, cli] } } },
    'OWN-03': { scope, reviewDays: 30, subanswers: {
      training: { support: 'supported', answer: 'Since 2026-04-24 Free, Pro and Pro+ interaction data trains GitHub models unless the user opts out; Business, Enterprise, enterprise-owned repositories and private repository content at rest are excluded.', evidenceIds: [train] } } },
    'RUN-01': { scope, subanswers: {
      managed_cloud: { support: 'supported', answer: 'Since 2026-10-28 each cloud session runs in a GitHub-managed cloud sandbox by default; Actions-based sessions remain an option.', evidenceIds: [cloud] },
      resources: { support: 'partial', answer: 'Sandboxes bill per compute second and per allocated GiB-second; sandbox sizes were not found.', evidenceIds: [sbx] },
      expiry: { support: 'partial', answer: 'Cloud sandboxes have no one-hour limit on total running time and snapshot on shutdown; snapshot retention was not stated.', evidenceIds: [cloud, sbx] },
      payer: { support: 'supported', answer: 'The repository owner (or the selected or personal account) pays for cloud sandboxes from the shared compute pool; the user runs custom hosts.', evidenceIds: [sbx] } } },
    'RUN-03': { scope, subanswers: {
      expiry: { support: 'partial', answer: 'Cloud sandboxes have no one-hour cap; stopped sandboxes keep a billed snapshot until deleted.', evidenceIds: [cloud, sbx] } } },
    'RUN-07': { scope, subanswers: {
      subscription_allowance: { support: 'supported', answer: 'Base plus flex credits reset monthly at 00:00 UTC on the 1st, with no carry-over.', evidenceIds: [ubb] },
      compute_cost: { support: 'supported', answer: 'Cloud sandbox compute, memory and snapshot storage are metered at published rates.', evidenceIds: [sbx] },
      alerts: { support: 'supported', answer: 'Budget alerts fire at 75%, 90% and 100%; product or SKU budgets can stop sandbox usage at 100%.', evidenceIds: [plans, sbx] } } },
  },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: per-token AI Credits billing details ($0.01 credit, base/flex, no carry-over, discounts), legacy premium requests only for annual Pro/Pro+ plans, Max and seat prices, Enterprise-included Copilot access and $10 Standalone (2026-10-28), cloud sandbox default with no one-hour limit (2026-10-28) and sandbox rates, Free limits, interaction-data training default, and app v1.2.0 / CLI v1.0.109 releases. Correction to the source recheck: CLI v1.0.110-1 is a pre-release; v1.0.109 is the latest release. Documentation only; no hands-on test.',
  roadmap: { locations: [{ url: 'https://github.blog/changelog/', result: '2026-11-12: 2026-10-28 entries (connected cloud experience GA, Enterprise-included Copilot access with self-serve rollout dates still to come) cited; no other dated commitments recorded in this port.' }] },
});
console.log(ids.join(' '));
