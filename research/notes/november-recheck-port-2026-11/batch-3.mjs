import { port } from './port.mjs';
const op = 'nov12-pricing';
port('omnara', {
  evidence: [{ id: op, kind: 'vendor-claimed', url: 'https://omnara.com/pricing', title: 'Omnara pricing', locator: 'Plans; FAQ',
    finding: 'No platform or per-seat fee; Omnara-managed models at provider token rates; credits for Omnara-managed models and machines carry a 5% service fee; managed runtime $0.0414 per GiB-hour online plus $0.20016 per GiB per 30 days retained; Enterprise via contact; accepted startups receive model and machine credits (amount not stated).' }],
  claims: { 'OWN-04': { scope: { version: 'Omnara pricing retrieved 2026-11-12' }, subanswers: {
    credits: { support: 'supported', answer: 'Managed models and machines are paid with credits that carry a 5% service fee; accepted startups can receive credits.', evidenceIds: [op] },
    model_cost: { support: 'supported', answer: 'Managed models at provider token rates, plus the 5% service fee on credits.', evidenceIds: [op] } } } },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: credits for Omnara-managed models and machines now carry a 5% service fee; startup credits exist. Documentation only.',
});
const ccr = 'nov12-releases';
port('claude-code', {
  evidence: [{ id: ccr, kind: 'vendor-claimed', sourceDate: '2026-11-10', url: 'https://github.com/anthropics/claude-code/releases', title: 'Claude Code releases', locator: 'v2.1.322 (Latest); v2.1.321; v2.1.319',
    finding: 'v2.1.322 marked Latest on 10 Nov 2026, after v2.1.321 (9 Nov) and v2.1.319 (6 Nov).' }],
  claims: { 'OWN-06': { scope: { version: 'Claude Code v2.1.322 (releases retrieved 2026-11-12)' }, subanswers: {
    release_activity: { support: 'supported', answer: 'v2.1.319 (Nov 6), v2.1.321 (Nov 9) and v2.1.322 (Nov 10, 2026, marked Latest); no binary was run.', evidenceIds: [ccr] } } } },
  summary: 'Ported from the podium-cloud November recheck and re-verified at source on 2026-11-12: releases through v2.1.322 (Nov 10, 2026).',
});
