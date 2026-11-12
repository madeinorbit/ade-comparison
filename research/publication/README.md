# Agent comparison publication contract

`build.mjs` turns the product files in `../products/`, which remain the source of truth, into one in-memory public export. adecomparison.com uses only its `products` format, through the [directory contract](../directory/README.md). The pair format described below is an older all-pairs export; this repository keeps it and its tests but does not render it. Its URLs come from `baseUrl` and `basePath` in `config.json` and point nowhere on the live site.

The additive `buildPublication({ format: 'products' })` mode serves the [adecomparison.com directory contract](../directory/README.md) without constructing pairs. It applies the same finding and lifecycle gates and exposes per-product public claims, cited sources, sanitized change references and identity-only register listings. Change summaries, authors and before/after values are not exported. The default pair format and its schema remain unchanged. Directory facets add their own evidence digest and independent interpretation review after this boundary.

## Pair coverage and finding states

Every full-profile product appears in every unordered pair with another full-profile product. Qualification and watch records do not generate pairs. Each pair contains all 51 criteria. A pair remains available even when none of its findings pass the publication checks.

The catalog keeps an internal publication workflow, but the public contract exposes verification semantics instead: `sourced` means a finding passed the source, scope, contradiction and freshness gates; `agent-cross-checked` means a different agent also checked its evidence, wording, scope and dates. The public field is `verificationStatus`, not `publicationStatus`. It never implies that a human reviewed an individual claim. Humans approve the rubric, instructions, templates and prototype.

Podium sells an ADE and controls this catalog's product selection, criteria, source interpretation and wording. Keep that conflict explicit in HTML, Markdown and JSON, including comparisons without Podium as a subject. The disclosure must tell visiting agents to verify consequential claims at the linked primary source. Agent cross-checks do not make the publisher independent.

The exporter includes only cited evidence and namespaces its IDs by product. Internal-only, expired, unresolved or otherwise ineligible findings receive one fixed `not-published` placeholder. Their answers, gaps, scope, history, context and unrelated evidence are not exported; they remain readable in the raw product files. An unpublished finding is not evidence that a capability is absent.
At least one cited source must have a retrieval date on or after the finding's `checkedAt`. Updating a claim's check date without recording a source recheck cannot make it appear fresh in the public export.

An independent claim review records `{ reviewer, date, contentHash: claimReviewHash(profile, claim) }` from `../lib.mjs`. The SHA-256 digest binds every claim field except `review` and `publication`, plus every cited evidence record, including atomic-only citations. Object-key order and unrelated evidence do not change it. A missing or mismatched digest fails catalog validation and cannot retain `agent-cross-checked`. `updateClaim` clears reviews on factual patches, including researcher and due-date changes. Reset edited findings to `public-candidate` with `review: null` for another independent review. Review identities and digests are not exported to `data/`.

Adding a full profile adds every pair involving that profile on the next build and updates all discovery files. An agent cross-check changes the finding's label and cross-checked coverage, not pair eligibility. The scheduled build removes individual findings after the catalog's `nextReviewAt`; the public contract calls this `nextCheckAt`, and rebuilding never extends it. Pair dates are null when no applicable finding remains. Sourced coverage includes every exported finding; cross-checked coverage counts separate agent passes only.

Each product source pass also checks official future-facing sources and records the locations, announcements and gaps in its `context.roadmapReview`, which is not exported. An announcement stays separate from released capability and is published only as a cited, scoped `announced` finding. A page build date is never a source check date. After a release or roadmap change, recheck affected facts rather than extending dates automatically.

## Stable formats

Paths are relative to `basePath`:

- `/` is the human-readable and agent-readable index.
- `/index.json` is the discovery index.
- `/index.md` and `/llms.txt` are concise Markdown discovery files.
- `/<sorted-id>-vs-<sorted-id>/` is canonical HTML.
- `index.md` and `data.json` beside each detail page contain the same published facts.
- `/methodology/` explains evidence states, freshness and the publisher's commercial interest.

Pair slugs sort product IDs so the same two products cannot produce two URLs. Criterion IDs and namespaced evidence IDs are stable anchors. HTML contains the complete text without client-side JavaScript. JSON-LD describes the visible dataset and its downloadable JSON/Markdown forms.

## Templates for future agents

Use [product-review-checklist.md](templates/product-review-checklist.md) before recording a separate agent cross-check. Use [pair-summary.md](templates/pair-summary.md) only if a later design adds curated introductions. Factual comparison rows must stay generated. Never author parallel facts in Astro or Markdown.

Run:

```sh
node research/validate.mjs
node --test research/publication/publication.test.mjs
npm run check
npm run build
```

## Lifecycle notices

Schema version 4 adds `products[].lifecycle` to pair and discovery JSON. An omitted catalog lifecycle becomes `{ "status": "unknown", "note": null }`, never active. A sunset notice describes its stated scope, such as the commercial company or hosted service. Local open-source continuation stays explicit. Lifecycle does not change capability support, criterion counts or all-pairs eligibility.

The optional `profile.lifecycle` object requires these fields when present:

```js
{
  status: 'unknown' | 'sunset',
  note: string,                 // Concise notice; do not repeat scope or continuation.
  scope: string,                // Name exactly what is sunsetting.
  continuation: string | null,  // Separately sourced ongoing use, if established.
  announcementDate: 'YYYY-MM-DD' | null,
  serviceEndDate: 'YYYY-MM-DD' | null,
  checkedAt: 'YYYY-MM-DD',
  nextReviewAt: 'YYYY-MM-DD',
  evidenceIds: string[],
  researcher: string,
  publication: 'internal-only' | 'public-candidate' | 'public-reviewed',
  contradictions: string[],
  review: null | { reviewer: string, date: 'YYYY-MM-DD', contentHash: string }
}
```

Use null for an unstated exact service end date. Preserve relative transition wording in the note or evidence finding without deriving a calendar deadline. An announcement is not a runtime test. Record the announcement date separately from retrieval and check dates. Review a notice with a stated end date within 30 days, and sooner when new evidence appears.

Research leaves `publication: 'public-candidate'` and `review: null`. An independent reviewer checks the primary evidence, notice, scope, continuation and dates, then records `{ reviewer, date, contentHash: lifecycleReviewHash(profile) }` and sets `public-reviewed`. The helper in `../lib.mjs` hashes lifecycle factual fields and cited evidence, including check dates and researcher identity. Direct factual or cited-evidence edits invalidate the digest. `updateLifecycle(profile, patch)` also clears the old review on factual patches unless a replacement review is explicitly supplied. Append lifecycle changes to the profile history with `claimIds: []` and cited evidence; later changes need before and after values.

`publicLifecycle(profile, date)` is the shared sanitation helper for agent and human exporters. It returns unknown for candidates, private, unresolved, stale, future-dated or invalidly reviewed notices. A public notice needs an independent digest-bound review, resolved public evidence, no contradiction, a nonblank scope, and at least one cited retrieval on or after `checkedAt`. The normal catalog validator rejects malformed records and invalid public reviews before pair generation. Expiration at build time suppresses the notice and its exclusive evidence while retaining the pair.

A publishable object exposes only `{ status, note, scope, continuation, announcementDate, serviceEndDate, checkedAt, crossCheckedAt, nextCheckAt, evidenceIds }`. It omits researcher/reviewer identities, digest, publication workflow and contradictions. Evidence IDs are namespaced as `productId:evidenceId`; include lifecycle citations in source selection even when no capability cites them. Agent HTML and Markdown use the same compact `lifecycleNotice(product)` text, with dates and linked source IDs on detail pages. JSON retains the structured dates. Pair freshness dates include lifecycle findings; capability coverage counts and per-product capability check windows remain unchanged. Human rendering has a separate owner and must consume the same sanitized finding.
