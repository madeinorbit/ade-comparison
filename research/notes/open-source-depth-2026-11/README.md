# Open-source depth pass, November 2026

This pass covered every covered ADE with a public source repository. It answered the directory filters and product-page criteria that were still unknown, using the public repository (code, in-repo docs, release assets) and the first-party website. Its scope was limited to what the site uses: the 25 capability filters in `research/directory/facets.json` and the ten story criteria on the product page (ACC-01, ACC-02, ACC-03, RUN-01, RUN-02, COORD-01, COORD-04, SHIP-03, OWN-01, OWN-04).

## Filter to criterion map

| Filter | Criterion (claim) |
| --- | --- |
| desktop-os, web-client, phone-client, cli | ACC-01 (cli may use ACC-05) |
| agents | ACC-02 |
| byo-subscription | ACC-03 |
| execution, laptop-independent | RUN-01 |
| isolation | RUN-02 |
| parallel-runs | COORD-01 |
| coordinator | COORD-03 |
| unattended-triggers | COORD-04 |
| issue-tracking | PLAN-06 |
| multiplayer | TEAM-01 |
| roles, sso | TEAM-02 |
| review-ui | SHIP-01 or TEAM-05 |
| pr-workflow | SHIP-03 |
| license | OWN-01 |
| self-hosting | OWN-02 |
| telemetry-opt-out | OWN-03 |
| pricing-model, paid-from, starting-price | OWN-04 (free-tier, starting-price and no-paid-plan may use OWN-08) |
| free-tier | OWN-08 |

## Evidence rules

- Cite a pinned commit or release tag: URL `https://github.com/<org>/<repo>/blob/<sha>/<path>#L<n>`, `commit` and `path` set. Use `kind: source-inspected` for code, `documented` for in-repo docs, README and first-party pages, `vendor-claimed` for marketing statements.
- The locator names the file, section or line range and the commit. The finding is a short paraphrase, never a quote presented as verbatim.
- A model provider is not a harness. A worktree is not a sandbox. A self-managed worker is not self-hosting. A relay is not a phone client.
- `yes` needs a released, usable capability. Source on an unreleased branch is not a release.
- `no` needs an explicit restriction (for example "macOS only", "Windows is not supported", a licence or a documented limit). Absence of code or docs keeps the value unknown.
- Pricing: `no-paid-plan` needs the first-party website, README and licence checked with no paid tier; other pricing-model options stay unknown unless explicitly excluded. `paid-from` stays unknown when no paid plan exists.
- Unknown stays unknown. Record the gap in the atomic answer.

## Mechanics

Write one spec per product and apply it with `ADE_COMPARISON_PUBLICATION_DATE=<date> node research/directory/author.mjs apply <spec.json>`. The helper adds evidence, patches atomic answers, clears the claim review, appends a change record with before and after values, adds the typed mappings and binds their digests. It refuses a mapping that would not publish.

A claim that was unknown takes the pass date as its check date. A claim that already had findings keeps its check date, because only the patched atomic answers were rechecked; the change record says which. Patching a claim changes the digest of every mapping on it: recheck those mappings at their sources and list them under `rebind`. The helper warns about any mapping left stale.

Cross-check: a different agent reads the cited sources fresh and records reviews with `author.mjs review-claims` and `author.mjs review-facets`. The helper refuses self-review. Only then does a value count as cross-checked.
