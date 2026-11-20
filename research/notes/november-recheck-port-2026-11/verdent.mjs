import { port } from './port.mjs';
const faq = 'nov12-pricing-faq';
const contra = 'The pricing FAQ retrieved 2026-11-12 still says "Your free trial includes 100 credits"; the v2.18 changelog says the Free Trial and 100 welcome credits are retired. Unresolved.';
port('verdent', {
  type: 'research-correction',
  evidence: [{ id: faq, kind: 'vendor-claimed', url: 'https://www.verdent.ai/pricing', title: 'Verdent pricing', locator: 'FAQ: credits',
    finding: 'The pricing FAQ says "Your free trial includes 100 credits, so you can explore Verdent without commitment." No trial length or free plan is stated.' }],
  claims: {
    'OWN-08': { contradictions: [contra], subanswers: {
      trial: { support: 'partial', answer: 'The v2.18 changelog retires the Free Trial, but the pricing FAQ still advertises a 100-credit trial.', evidenceIds: ['nov07-changes', faq] },
      credits_trial: { support: 'partial', answer: 'The changelog discontinues the 100 welcome credits; the pricing FAQ still describes 100 trial credits.', evidenceIds: ['nov07-changes', faq] } } },
    'OWN-04': { contradictions: [contra], subanswers: {
      trial: { support: 'partial', answer: 'The pricing FAQ describes a 100-credit free trial, which the v2.18 changelog says is retired.', evidenceIds: [faq, 'nov07-changes'] } } },
  },
  summary: 'Contradiction surfaced by the podium-cloud November recheck and confirmed at source on 2026-11-12: the Verdent pricing FAQ still advertises a 100-credit free trial that the v2.18 changelog retires. OWN-08 trial atoms move from unsupported to partial and both claims carry the contradiction until Verdent aligns its pages.',
});
